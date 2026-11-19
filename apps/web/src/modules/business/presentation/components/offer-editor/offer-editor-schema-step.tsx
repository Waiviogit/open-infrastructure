'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { PlusIcon, TrashIcon } from '@/icons';

import {
  getOfferTerms,
  patchOfferTerms,
  type OfferDraftFields,
} from '../../../domain/offer-form.types';
import {
  buildJsonSchema,
  createEmptySchemaPropertyRow,
  isSchemaRowsValid,
  parseJsonSchema,
  SERVICE_ORDER_SCHEMA_TYPES,
  type SchemaPropertyRow,
  type ServiceOrderSchemaType,
} from '../../../domain/service-order-schema';
import { BusinessButton } from '../../ui/business-button';
import { BUSINESS_FOCUS_RING } from '../../ui/classes';
import { offerEditorFieldClass, offerEditorLabelClass } from './offer-editor-field-styles';

const ICON_SIZE = 16;
/** Nested properties indent on the reading side (RTL-safe). */
const NESTED_CLASS = 'border-s-2 border-border ps-3';

export type OfferEditorSchemaStepProps = {
  fields: OfferDraftFields;
  onFieldsChange: (fields: OfferDraftFields) => void;
};

function typeLabel(t: (key: string) => string, type: ServiceOrderSchemaType): string {
  return t(`business_schema_builder_type_${type}`);
}

function rowHasAdvancedFields(row: SchemaPropertyRow): boolean {
  return (
    row.title.trim().length > 0 ||
    row.description.trim().length > 0 ||
    row.defaultValue.trim().length > 0 ||
    row.enumText.trim().length > 0 ||
    row.format.trim().length > 0 ||
    row.pattern.trim().length > 0 ||
    row.advancedRaw.trim().length > 0
  );
}

type PropertyEditorProps = {
  row: SchemaPropertyRow;
  depth: number;
  t: (key: string) => string;
  onChange: (row: SchemaPropertyRow) => void;
  onRemove: () => void;
};

function PropertyEditor({ row, depth, t, onChange, onRemove }: PropertyEditorProps) {
  const allowNested = depth === 0;
  const typeOptions = allowNested
    ? SERVICE_ORDER_SCHEMA_TYPES
    : (['string', 'number', 'integer', 'boolean', 'null'] as const);
  const [advancedOpen, setAdvancedOpen] = useState(() => rowHasAdvancedFields(row));

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={offerEditorLabelClass}>
          {t('business_schema_builder_field_key')}
          <input
            type="text"
            value={row.key}
            onChange={(e) => onChange({ ...row, key: e.target.value })}
            className={offerEditorFieldClass}
          />
        </label>
        <label className={offerEditorLabelClass}>
          {t('business_schema_builder_field_type')}
          <select
            value={row.type}
            onChange={(e) => {
              const nextType = e.target.value as ServiceOrderSchemaType;
              onChange({
                ...row,
                type: nextType,
                children:
                  nextType === 'object' && row.children.length === 0
                    ? [createEmptySchemaPropertyRow()]
                    : row.children,
                itemSchema:
                  nextType === 'array' && !row.itemSchema
                    ? createEmptySchemaPropertyRow()
                    : row.itemSchema,
              });
            }}
            className={offerEditorFieldClass}
          >
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {typeLabel(t, opt)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-body-sm">
        <input
          type="checkbox"
          checked={row.required}
          onChange={(e) => onChange({ ...row, required: e.target.checked })}
          className={`size-4 rounded-btn accent-accent ${BUSINESS_FOCUS_RING}`}
        />
        {t('business_schema_builder_field_required')}
      </label>
      <BusinessButton
        variant="ghost"
        size="sm"
        onClick={() => setAdvancedOpen((open) => !open)}
        className="self-start"
        aria-expanded={advancedOpen}
      >
        {advancedOpen
          ? t('business_schema_builder_hide_advanced')
          : t('business_schema_builder_show_advanced')}
      </BusinessButton>
      {advancedOpen ? (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_title')}
              <input
                type="text"
                value={row.title}
                onChange={(e) => onChange({ ...row, title: e.target.value })}
                className={offerEditorFieldClass}
              />
            </label>
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_description')}
              <input
                type="text"
                value={row.description}
                onChange={(e) => onChange({ ...row, description: e.target.value })}
                className={offerEditorFieldClass}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_default')}
              <input
                type="text"
                value={row.defaultValue}
                onChange={(e) => onChange({ ...row, defaultValue: e.target.value })}
                className={offerEditorFieldClass}
                placeholder='""'
              />
            </label>
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_enum')}
              <input
                type="text"
                value={row.enumText}
                onChange={(e) => onChange({ ...row, enumText: e.target.value })}
                className={offerEditorFieldClass}
                placeholder='["a","b"]'
              />
            </label>
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_format')}
              <input
                type="text"
                value={row.format}
                onChange={(e) => onChange({ ...row, format: e.target.value })}
                className={offerEditorFieldClass}
              />
            </label>
            <label className={offerEditorLabelClass}>
              {t('business_schema_builder_field_pattern')}
              <input
                type="text"
                value={row.pattern}
                onChange={(e) => onChange({ ...row, pattern: e.target.value })}
                className={offerEditorFieldClass}
              />
            </label>
          </div>
          <label className={offerEditorLabelClass}>
            {t('business_schema_builder_field_advanced')}
            <textarea
              value={row.advancedRaw}
              onChange={(e) => onChange({ ...row, advancedRaw: e.target.value })}
              rows={3}
              className={`${offerEditorFieldClass} font-mono text-caption`}
              placeholder='{"const":"x","oneOf":[...]}'
            />
          </label>
        </div>
      ) : null}
      {row.type === 'object' && allowNested ? (
        <div className={NESTED_CLASS}>
          <p className="mb-2 text-caption text-fg-secondary">
            {t('business_schema_builder_nested_properties')}
          </p>
          {row.children.map((child, index) => (
            <div key={child.id} className="mb-2">
              <PropertyEditor
                row={child}
                depth={depth + 1}
                t={t}
                onChange={(nextChild) => {
                  const children = [...row.children];
                  children[index] = nextChild;
                  onChange({ ...row, children });
                }}
                onRemove={() =>
                  onChange({
                    ...row,
                    children: row.children.filter((_, i) => i !== index),
                  })
                }
              />
            </div>
          ))}
          <BusinessButton
            size="sm"
            onClick={() =>
              onChange({
                ...row,
                children: [...row.children, createEmptySchemaPropertyRow()],
              })
            }
          >
            <PlusIcon size={ICON_SIZE} />
            {t('business_schema_builder_add_property')}
          </BusinessButton>
        </div>
      ) : null}
      {row.type === 'array' && allowNested && row.itemSchema ? (
        <div className={NESTED_CLASS}>
          <p className="mb-2 text-caption text-fg-secondary">
            {t('business_schema_builder_array_items')}
          </p>
          <PropertyEditor
            row={row.itemSchema}
            depth={depth + 1}
            t={t}
            onChange={(itemSchema) => onChange({ ...row, itemSchema })}
            onRemove={() => onChange({ ...row, itemSchema: createEmptySchemaPropertyRow() })}
          />
        </div>
      ) : null}
      <BusinessButton
        variant="quiet"
        size="sm"
        onClick={onRemove}
        className="self-start"
      >
        <TrashIcon size={ICON_SIZE} />
        {t('business_schema_builder_remove_property')}
      </BusinessButton>
    </div>
  );
}

export function OfferEditorSchemaStep({ fields, onFieldsChange }: OfferEditorSchemaStepProps) {
  const { t } = useI18n();
  const terms = getOfferTerms(fields);
  const initialRows = useMemo(() => {
    const existing = terms.serviceOrderSchema;
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      return parseJsonSchema(existing as Record<string, unknown>);
    }
    return [createEmptySchemaPropertyRow()];
  }, []);
  const [rows, setRows] = useState<SchemaPropertyRow[]>(initialRows);

  function commitRows(next: SchemaPropertyRow[]) {
    setRows(next);
    const schema = buildJsonSchema(next);
    const hasProperties =
      typeof schema.properties === 'object' &&
      schema.properties !== null &&
      Object.keys(schema.properties as object).length > 0;
    onFieldsChange(
      patchOfferTerms(fields, {
        serviceOrderSchema: hasProperties ? schema : undefined,
      }),
    );
  }

  const valid = isSchemaRowsValid(rows);
  const preview = JSON.stringify(buildJsonSchema(rows), null, 2);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-body-sm font-weight-label text-heading">
          {t('business_schema_builder_title')}
        </p>
        <p className="mt-1 text-caption text-fg-secondary">{t('business_schema_builder_hint')}</p>
      </div>
      {rows.map((row, index) => (
        <PropertyEditor
          key={row.id}
          row={row}
          depth={0}
          t={t}
          onChange={(nextRow) => {
            const next = [...rows];
            next[index] = nextRow;
            commitRows(next);
          }}
          onRemove={() => {
            const next = rows.filter((_, i) => i !== index);
            commitRows(next.length > 0 ? next : [createEmptySchemaPropertyRow()]);
          }}
        />
      ))}
      <BusinessButton
        size="sm"
        onClick={() => commitRows([...rows, createEmptySchemaPropertyRow()])}
        className="self-start"
      >
        <PlusIcon size={ICON_SIZE} />
        {t('business_schema_builder_add_property')}
      </BusinessButton>
      {!valid ? (
        <p className="text-caption text-error" role="alert">
          {t('business_schema_builder_invalid')}
        </p>
      ) : null}
      <details className="rounded-card border border-border px-3 py-2">
        <summary
          className={`cursor-pointer rounded-btn text-caption font-weight-label ${BUSINESS_FOCUS_RING}`}
        >
          {t('business_schema_builder_json_preview')}
        </summary>
        <pre className="mt-2 overflow-x-auto font-mono text-caption text-fg-secondary">
          {preview}
        </pre>
      </details>
    </div>
  );
}
