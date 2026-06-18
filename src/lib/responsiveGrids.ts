/** Tailwind grid classes for KPI/stats rows — scales up at 2xl+ to account for sidebar width. */

export const statsGridCols: Record<2 | 3 | 4 | 5 | 6 | 7, string> = {

  2: 'grid-cols-2',

  3: 'grid-cols-2 sm:grid-cols-3',

  4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4',

  5: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',

  6: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6',

  7: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7',

};



/** Grid for creative/asset card galleries. */

export const creativeGalleryGrid =

  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6';



/** Inline metrics row inside list items (campaign/ad set rows). */

export const inlineMetricsGrid =

  'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-3 min-w-0';


