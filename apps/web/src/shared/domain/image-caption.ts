/** Caption under a standalone image in posts and in the editor (styled in `app/global.css`). */
export const POST_IMAGE_CAPTION_CLASS = 'post-image-caption';

/** Alt text that ends like an image file name (`image.png`, `Screenshot 2024-05-01 at 10.12.33.jpeg`). */
const FILE_NAME_ALT = /\.(?:png|jpe?g|jfif|gif|webp|avif|svg|bmp|heic|heif|tiff?|ico)$/i;
/** Camera / phone file names without an extension (`IMG_1234`, `DSC01234`, `PXL_20240501_101233`). */
const CAMERA_FILE_ALT = /^(?:img|dsc|dscn|dscf|pxl|dcim|photo|pic|vid|mvimg|signal)[-_ ]?\d[\w-]*$/i;
const URL_ALT = /^(?:https?:)?\/\/|^www\./i;
/** Hive front ends fill alt with a placeholder word when the author typed nothing. */
const PLACEHOLDER_ALTS: ReadonlySet<string> = new Set(['image', 'img', 'photo', 'picture', 'pic', 'screenshot']);

/**
 * Whether an image alt text is worth showing as a caption under the image:
 * not empty, not a file name, not a URL, not a placeholder word.
 */
export function isImageCaptionAlt(alt: string): boolean {
  const text = alt.trim();
  if (!text) {
    return false;
  }
  if (PLACEHOLDER_ALTS.has(text.toLowerCase())) {
    return false;
  }
  return !FILE_NAME_ALT.test(text) && !CAMERA_FILE_ALT.test(text) && !URL_ALT.test(text);
}
