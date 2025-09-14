////////////////////////////////////// LANDTRENDR (complete, drop-in) ////////////////////////////////////////
// Full script: runs LT-GEE, builds discrete Year-of-Detection classes (7 bins by default),
// adds all map layers with correct palettes, and creates a single stacked legend UI.
// Note: you must have added the LT-GEE repo to your GEE account: 
// https://code.earthengine.google.com/?accept_repo=users/emaprlab/public


////////////////////////////////////// LANDTRENDR (complete, drop-in with horizontal legends) ////////////////////////////////////////
// Runs LT-GEE, builds discrete Year-of-Detection classes, maps all products with legends,
// and prints verbose console summaries for interpretation.
// Reference: https://openmrv.org/web/guest/w/modules/mrv/modules_2/landtrendr

// ---------------------- BASEMAP ----------------------
Map.setOptions('SATELLITE');

// ---------------------- INPUTS ----------------------
var domain = ee.FeatureCollection('projects/servir-sco-assets/assets/Rx_Fire/Vector_Data/Sewanee_Domain');
var comp_12 = ee.FeatureCollection("projects/servir-sco-assets/assets/Rx_Fire/Vector_Data/Comp_12");

var startYear = 1985;
var endYear = 2025;
var startDay = '01-01';
var endDay = '12-31';
var aoi = domain;
var index = 'NBR';
var maskThese = ['cloud', 'shadow', 'snow', 'water'];

// ---------------------- LANDTRENDR PARAMETERS ----------------------
var runParams = { 
  maxSegments: 6,
  spikeThreshold: 1,
  vertexCountOvershoot: 3,
  preventOneYearRecovery: false,
  recoveryThreshold: 1,
  pvalThreshold: 0.05,
  bestModelProportion: 0.75,
  minObservationsNeeded: 3
};

var changeParams = {
  delta:  'loss',
  sort:   'greatest',
  year:   {checked:true, start:startYear, end:endYear},
  mag:    {checked:true, value:150,  operator:'>'},
  dur:    {checked:true, value:19,   operator:'<'}, 
  preval: {checked:true, value:150,  operator:'>'},
  mmu:    {checked:true, value:3}
};

// ---------------------- RUN LANDTRENDR ----------------------
var ltgee = require('users/emaprlab/public:Modules/LandTrendr.js');
changeParams.index = index;

var lt = ltgee.runLT(startYear, endYear, startDay, endDay, aoi, index, [], runParams, maskThese);
var changeImg = ltgee.getChangeMap(lt, changeParams);

// ---------------------- VISUALIZATION PARAMETERS ----------------------
var yodPalette = ['#9400D3', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000'];

var yodVizParms = {
  min: startYear,
  max: endYear,
  palette: yodPalette
};
var magVizParms = {
  min: 200,
  max: 800,
  palette: ['#ffffcc','#a1dab4','#41b6c4','#2c7fb8','#253494']
};
var durVizParms = {
  min: 1,
  max: 20,
  palette: ['#f7fcf0','#ccebc5','#7bccc4','#2b8cbe','#084081']
};
var prevalVizParms = {
  min: 100,
  max: 800,
  palette: ['#fff7ec','#fee8c8','#fdd49e','#fc8d59','#d7301f','#7f0000']
};
var rateVizParms = {
  min: -100,
  max: 100,
  palette: ['#67001f','#d6604d','#fddbc7','#d1e5f0','#4393c3','#2166ac']
};

// ---------------------- CREATE DISCRETE YOD CLASSES ----------------------
var yod = changeImg.select('yod'); 
var nBins = yodPalette.length;     
var binSize = Math.ceil((endYear - startYear + 1) / nBins);

var yodClass = yod
  .subtract(startYear)
  .divide(binSize)
  .floor()
  .toInt();
yodClass = yodClass.where(yodClass.gt(nBins - 1), nBins - 1);
yodClass = yodClass.updateMask(yod.gte(startYear));

// ---------------------- ADD MAP LAYERS ----------------------
Map.centerObject(aoi, 14);
Map.addLayer(changeImg.clip(aoi).select(['mag']), magVizParms, 'Magnitude of Change');
Map.addLayer(yodClass.clip(aoi), {min: 0, max: nBins - 1, palette: yodPalette}, 'Year of Detection (binned)');
Map.addLayer(changeImg.clip(aoi).select(['dur']), durVizParms, 'Duration');
Map.addLayer(changeImg.clip(aoi).select(['preval']), prevalVizParms, 'Prevalence');
Map.addLayer(changeImg.clip(aoi).select(['rate']), rateVizParms, 'Rate');






////////////////
// ---------------------- LEGEND UI BUILDERS ----------------------

// Vertical continuous legend (each swatch+label stacked)
function makeVerticalLegend(visParams, title) {
  var min = visParams.min;
  var max = visParams.max;
  var palette = visParams.palette;
  var nColors = palette.length;
  var stepSize = (max - min) / nColors;

  var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '6px'}
  });

  panel.add(ui.Label(title, {fontWeight: 'bold', fontSize: '12px'}));

  palette.forEach(function(color, idx) {
    var from = min + idx * stepSize;
    var to   = (idx === nColors - 1) ? max : (min + (idx + 1) * stepSize);
    var labelText = from.toFixed(0) + ' – ' + to.toFixed(0);

    var row = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      widgets: [
        ui.Label('', {
          backgroundColor: color,
          padding: '8px',
          margin: '0 6px 4px 0',
          width: '20px',
          border: '1px solid #666'
        }),
        ui.Label(labelText, {fontSize: '10px'})
      ]
    });
    panel.add(row);
  });

  return panel;
}

// Vertical discrete legend (for YOD bins)
function makeDiscreteVerticalLegend(palette, labels, title) {
  var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '6px'}
  });

  panel.add(ui.Label(title, {fontWeight: 'bold', fontSize: '12px'}));

  palette.forEach(function(color, i) {
    var row = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      widgets: [
        ui.Label('', {
          backgroundColor: color,
          padding: '8px',
          margin: '0 6px 4px 0',
          width: '20px',
          border: '1px solid #666'
        }),
        ui.Label(labels[i], {fontSize: '10px'})
      ]
    });
    panel.add(row);
  });

  return panel;
}

// ---------------------- LEGEND CONTAINER ----------------------
var legendContainer = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.85)',
    maxHeight: '80%'
  },
  layout: ui.Panel.Layout.flow('horizontal')  // side by side
});

// Build year-bin labels
var yearBinLabels = [];
for (var i = 0; i < nBins; i++) {
  var s = startYear + i * binSize;
  var e = Math.min(startYear + (i + 1) * binSize - 1, endYear);
  yearBinLabels.push((s === e) ? String(s) : String(s) + ' - ' + String(e));
}

// ---------------------- ADD LEGENDS SIDE BY SIDE ----------------------
legendContainer.add(makeVerticalLegend(magVizParms, 'Magnitude of Change'));
legendContainer.add(makeDiscreteVerticalLegend(yodPalette, yearBinLabels, 'Year of Detection (binned)'));
legendContainer.add(makeVerticalLegend(durVizParms, 'Duration (years)'));
legendContainer.add(makeVerticalLegend(prevalVizParms, 'Prevalence'));
legendContainer.add(makeVerticalLegend(rateVizParms, 'Rate'));

Map.add(legendContainer);


// ---------------------- OPTIONAL: HISTOGRAMS ----------------------
var hist_yod = ui.Chart.image.histogram({
  image: changeImg.clip(aoi).select(['yod']),
  region: aoi,
  scale: 30,
  maxPixels: 1e9
});
print('hist_yod', hist_yod);

var hist_mag = ui.Chart.image.histogram({
  image: changeImg.clip(aoi).select(['mag']),
  region: aoi,
  scale: 30,
  maxPixels: 1e9
});
print('hist_mag', hist_mag);

// ---------------------- VERBOSE SUMMARIES ----------------------
print('--- LandTrendr Product Summaries (from OpenMRV) ---');

print('Magnitude of Change',
  'Represents the absolute spectral distance (usually from NBR or NDVI) between the pre-disturbance state and the lowest point of disturbance.\n' +
  '- Higher magnitude means more severe vegetation loss or disturbance.\n' +
  '- Lower magnitude suggests subtle change, possibly selective thinning or minor events.\n' +
  '- Useful for distinguishing high-severity fire, clearcut logging, or stand-replacing events from lighter disturbances.'
);

print('Duration',
  'Duration is the number of consecutive years over which a disturbance occurs.\n' +
  '- Short duration (1–2 years) often represents abrupt events (fire, clearcut).\n' +
  '- Long duration (5–20 years) indicates gradual processes (insect outbreak, slow decline, chronic stress).\n' +
  '- Helps differentiate pulse disturbances from long-term degradation.'
);

print('Year of Detection',
  'The calendar year when LandTrendr identifies the start of a disturbance segment.\n' +
  '- Mapped discretely into bins or per-year colors.\n' +
  '- Key for linking disturbance events with known drivers (fire records, storm events, land-use change).\n' +
  '- Provides temporal precision for disturbance monitoring.'
);

print('Rate of Change',
  'The slope of the fitted LandTrendr segment representing disturbance.\n' +
  '- Calculated as magnitude divided by duration.\n' +
  '- Steeper rates imply abrupt disturbances (e.g., fire).\n' +
  '- Gentle slopes imply slow declines or progressive thinning.\n' +
  '- Complements magnitude and duration to describe disturbance dynamics.'
);

print('Prevalence (Pre-Change Value)',
  'The spectral index value before the disturbance event.\n' +
  '- High pre-change values suggest dense, healthy vegetation before disturbance.\n' +
  '- Low pre-change values indicate already sparse or degraded vegetation.\n' +
  '- Useful for contextualizing magnitude: the same drop in index can mean different ecological impacts depending on the starting condition.'
);

print('Reference: OpenMRV LandTrendr Module – https://openmrv.org/web/guest/w/modules/mrv/modules_2/landtrendr');
