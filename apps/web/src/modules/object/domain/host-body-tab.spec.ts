import {
  activeHostBodyTab,
  hostBodySourceFromModel,
  hostBodyTabForObjectType,
  isHostBodyTabSegment,
  objectPageHidesRightRail,
} from './host-body-tab';

const BODIES = { htmlContent: '<p>h</p>', pageContent: '# Page', legalText: '# Terms' };

describe('host body tabs', () => {
  it.each([
    ['html', 'html', 'HTML', 'htmlContent', 'html'],
    ['page', 'page', 'Page', 'pageContent', 'markdown'],
    ['legal_document', 'document', 'Document', 'legalText', 'markdown'],
  ])('%s opens on the %s tab', (objectType, segment, label, updateType, format) => {
    expect(hostBodyTabForObjectType(objectType)).toMatchObject({ segment, label, updateType, format });
    expect(isHostBodyTabSegment(segment)).toBe(true);
  });

  it('has no host body tab for other types', () => {
    expect(hostBodyTabForObjectType('skill')).toBeNull();
    expect(hostBodyTabForObjectType('restaurant')).toBeNull();
    expect(isHostBodyTabSegment('details')).toBe(false);
  });

  it('is active and hides the right rail only on its own tab', () => {
    expect(activeHostBodyTab('page', 'page')?.label).toBe('Page');
    expect(objectPageHidesRightRail('page', 'page')).toBe(true);
    expect(objectPageHidesRightRail('legal_document', 'document')).toBe(true);
    expect(objectPageHidesRightRail('html', 'html')).toBe(true);
    expect(objectPageHidesRightRail('page', 'social')).toBe(false);
    expect(objectPageHidesRightRail('page', 'html')).toBe(false);
  });

  it('reads the body of the type', () => {
    expect(hostBodySourceFromModel({ objectTypeKey: 'html', ...BODIES })).toBe('<p>h</p>');
    expect(hostBodySourceFromModel({ objectTypeKey: 'page', ...BODIES })).toBe('# Page');
    expect(hostBodySourceFromModel({ objectTypeKey: 'legal_document', ...BODIES })).toBe('# Terms');
    expect(hostBodySourceFromModel({ objectTypeKey: 'skill', ...BODIES })).toBeNull();
  });
});
