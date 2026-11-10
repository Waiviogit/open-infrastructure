import { isImageCaptionAlt } from './image-caption';

describe('isImageCaptionAlt', () => {
  it.each(['Cheam Sushi tray', 'View from the 5th floor', 'Agassiz Tray.', 'Чек за обед'])(
    'shows %p',
    (alt) => {
      expect(isImageCaptionAlt(alt)).toBe(true);
    },
  );

  it.each([
    '',
    '   ',
    'image.png',
    'IMG_1234.JPG',
    'Screenshot 2024-05-01 at 10.12.33.jpeg',
    'photo.webp',
    'IMG_20240501_101233',
    'DSC01234',
    'PXL_20240501_101233',
    'https://images.hive.blog/p/photo.jpg',
    'www.example.com/a',
    'image',
    'Screenshot',
  ])('hides %p', (alt) => {
    expect(isImageCaptionAlt(alt)).toBe(false);
  });
});
