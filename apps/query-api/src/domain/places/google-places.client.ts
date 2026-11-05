import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import {
  googlePhotoMediaResponseSchema,
  googlePlaceSchema,
  googleSearchTextResponseSchema,
  type GooglePlace,
} from './google-places.schemas';
import {
  PLACES_DETAILS_FIELD_MASK,
  PLACES_PHOTO_MAX_WIDTH_PX,
  PLACES_SEARCH_FIELD_MASK,
  PLACES_SEARCH_RADIUS_M,
} from './places.constants';

const DEFAULT_TIMEOUT_MS = 10_000;
const HTTP_NOT_FOUND = 404;

export type PlacesSearchTextInput = {
  query: string;
  languageCode: string;
  limit: number;
  bias: { latitude: number; longitude: number } | null;
};

/** `failed` = network error, non-2xx, malformed body or no API key. */
export type PlacesDetailsResult =
  | { status: 'found'; place: GooglePlace }
  | { status: 'not_found' }
  | { status: 'failed' };

/**
 * Thin adapter over Google Places API (New). Never throws: failures are logged
 * and returned as empty / `failed` so the editor keeps working without Google.
 */
@Injectable()
export class GooglePlacesClient {
  private readonly logger = new Logger(GooglePlacesClient.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.apiKey());
  }

  async searchText(input: PlacesSearchTextInput): Promise<GooglePlace[] | null> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      return null;
    }
    const body: Record<string, unknown> = {
      textQuery: input.query,
      languageCode: input.languageCode,
      pageSize: input.limit,
    };
    if (input.bias) {
      body.locationBias = {
        circle: {
          center: { latitude: input.bias.latitude, longitude: input.bias.longitude },
          radius: PLACES_SEARCH_RADIUS_M,
        },
      };
    }

    const json = await this.request(`${this.baseUrl()}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (json.status !== 'ok') {
      return null;
    }
    const parsed = googleSearchTextResponseSchema.safeParse(json.body);
    if (!parsed.success) {
      this.logger.warn('Google searchText returned an unexpected body');
      return null;
    }
    return parseValidPlaces(parsed.data.places);
  }

  async getDetails(placeId: string, languageCode: string): Promise<PlacesDetailsResult> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      return { status: 'failed' };
    }
    const url = new URL(`${this.baseUrl()}/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set('languageCode', languageCode);
    const json = await this.request(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_DETAILS_FIELD_MASK,
      },
    });
    if (json.status === 'not_found') {
      return { status: 'not_found' };
    }
    if (json.status !== 'ok') {
      return { status: 'failed' };
    }
    const parsed = googlePlaceSchema.safeParse(json.body);
    if (!parsed.success) {
      this.logger.warn('Google place details returned an unexpected body');
      return { status: 'failed' };
    }
    return { status: 'found', place: parsed.data };
  }

  /**
   * Resolves a photo resource name (`places/{id}/photos/{ref}`) to a short-lived public
   * `photoUri` so the API key never reaches the browser.
   */
  async getPhotoUri(photoName: string): Promise<string | null> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      return null;
    }
    const url = new URL(`${this.baseUrl()}/${photoName}/media`);
    url.searchParams.set('maxWidthPx', String(PLACES_PHOTO_MAX_WIDTH_PX));
    url.searchParams.set('skipHttpRedirect', 'true');
    const json = await this.request(url.toString(), {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': apiKey },
    });
    if (json.status !== 'ok') {
      return null;
    }
    const parsed = googlePhotoMediaResponseSchema.safeParse(json.body);
    return parsed.success ? parsed.data.photoUri : null;
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<{ status: 'ok'; body: unknown } | { status: 'not_found' } | { status: 'failed' }> {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
      if (response.status === HTTP_NOT_FOUND) {
        return { status: 'not_found' };
      }
      if (!response.ok) {
        this.logger.warn(
          `Google Places HTTP ${response.status}: ${await describeGoogleError(response)}`,
        );
        return { status: 'failed' };
      }
      return { status: 'ok', body: (await response.json()) as unknown };
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Google Places request failed',
      );
      return { status: 'failed' };
    }
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('googlePlaces.apiKey')?.trim() || undefined;
  }

  private baseUrl(): string {
    const raw = this.config.get<string>('googlePlaces.baseUrl') ?? '';
    return raw.replace(/\/$/, '');
  }

  private timeoutMs(): number {
    return this.config.get<number>('googlePlaces.requestTimeoutMs') ?? DEFAULT_TIMEOUT_MS;
  }
}

const googleErrorBodySchema = z.object({
  error: z.object({
    status: z.string().optional(),
    message: z.string().optional(),
    details: z.array(z.object({ reason: z.string().optional() }).passthrough()).optional(),
  }),
});

const GOOGLE_ERROR_MESSAGE_MAX_LENGTH = 300;

/**
 * Google's own reason for a failed call (e.g. `PERMISSION_DENIED /
 * API_KEY_IP_ADDRESS_BLOCKED`, `SERVICE_DISABLED`, `BILLING_DISABLED`) so a 403
 * is diagnosable from the logs. The request API key is never part of the body.
 */
async function describeGoogleError(response: Response): Promise<string> {
  let raw: unknown;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    return 'no JSON body';
  }
  const parsed = googleErrorBodySchema.safeParse(raw);
  if (!parsed.success) {
    return 'unexpected error body';
  }
  const { status, message, details } = parsed.data.error;
  const reasons = (details ?? []).map((d) => d.reason).filter(Boolean).join(',');
  return [status, reasons, message?.slice(0, GOOGLE_ERROR_MESSAGE_MAX_LENGTH)]
    .filter(Boolean)
    .join(' / ');
}

function parseValidPlaces(raw: readonly unknown[]): GooglePlace[] {
  const places: GooglePlace[] = [];
  for (const item of raw) {
    const parsed = googlePlaceSchema.safeParse(item);
    if (parsed.success) {
      places.push(parsed.data);
    }
  }
  return places;
}
