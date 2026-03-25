// ==============================
// 1. MASTER METRIC SWITCH
// ==============================
// 👇 Type ONE of these exactly as written: 'EROSION', 'NDVI', 'FLOOD', 'RAINFALL'
var TARGET_METRIC = 'EROSION'; 

// ==============================
// 2. Static Variables & Imports
// ==============================
var text = require('users/gena/packages:text');

var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 10);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

var majuliBounds = majuli.geometry().bounds();
var coords = ee.List(majuliBounds.coordinates().get(0));
var bottomRight = ee.List(coords.get(1)); 
var maxX = ee.Number(bottomRight.get(0));
var minY = ee.Number(bottomRight.get(1));

// Bottom-Right Corner for Year Label
var textLocation = ee.Geometry.Point([maxX.subtract(0.12), minY.add(0.05)]);

var dem = ee.Image("USGS/SRTMGL1_003").clip(majuli);
var slope = ee.Terrain.slope(dem);
var steepSlope = slope.gte(3).selfMask();

var years = ee.List.sequence(2018, 2025);

// ==============================
// 3. The Time-Lapse Function
// ==============================
var createYearlyFrame = function(year) {
  var y = ee.Number(year);
  
  var shortBeforeStart = ee.Date.fromYMD(y, 3, 1);  
  var shortBeforeEnd   = ee.Date.fromYMD(y, 5, 31);
  var shortAfterStart  = ee.Date.fromYMD(y, 8, 1);
  var shortAfterEnd    = ee.Date.fromYMD(y, 11, 15); 
  
  var longBeforeStart = ee.Date.fromYMD(y, 1, 1);
  var longBeforeEnd   = ee.Date.fromYMD(y, 6, 30);
  var longAfterStart  = ee.Date.fromYMD(y, 7, 1);
  var longAfterEnd    = ee.Date.fromYMD(y, 12, 31);
  var floodRainStart = ee.Date.fromYMD(y, 7, 1);
  var floodRainEnd   = ee.Date.fromYMD(y, 10, 15);

  var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(majuli)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70)) 
    .select(['B2','B3','B4','B8']);

  var shortBefore = s2.filterDate(shortBeforeStart, shortBeforeEnd).median().clip(majuli);
  var shortAfter  = s2.filterDate(shortAfterStart, shortAfterEnd).median().clip(majuli);
  var longBefore  = s2.filterDate(longBeforeStart, longBeforeEnd).median().clip(majuli);
  var longAfter   = s2.filterDate(longAfterStart, longAfterEnd).median().clip(majuli);

  // STRICT NDVI Math (-0.25 threshold)
  var ndviBefore = shortBefore.normalizedDifference(['B8','B4']).unmask(longBefore.normalizedDifference(['B8','B4']));
  var ndviAfter = shortAfter.normalizedDifference(['B8','B4']).unmask(longAfter.normalizedDifference(['B8','B4']));
  var ndviChange = ndviAfter.subtract(ndviBefore);
  var erosionNDVI = ndviChange.lt(-0.25).selfMask();

  // STRICT Flood Math (-16 dB threshold)
  var s1Image = ee.ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(majuli)
    .filterDate(floodRainStart, floodRainEnd)
    .filter(ee.Filter.eq('instrumentMode','IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV'))
    .select('VV')
    .median().clip(majuli);
  var floodMask = s1Image.lt(-16).selfMask();

  // PERMANENT WATER MASK
  var jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(majuli);
  var permanentWater = jrc.select('occurrence').gte(80); 
  var landMask = permanentWater.unmask(0).not();

  // Rainfall (Kept purely for the visualization switch, removed from erosion math)
  var highRain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    .filterBounds(majuli)
    .filterDate(floodRainStart, floodRainEnd)
    .sum().clip(majuli)
    .gt(600).selfMask();

  // STRICT EROSION SCORE (Must hit 4)
  var erosionScore = erosionNDVI.multiply(3)
    .add(floodMask.unmask(0)) 
    .add(steepSlope.unmask(0));
    
  var erosionRaw = erosionScore.gte(4).updateMask(landMask).selfMask();
  var erosionRisk = erosionRaw.updateMask(erosionRaw.connectedPixelCount(3).gte(3));

  // ==============================
  // 4. Dynamic Visualization Switch
  // ==============================
  var baseVis = longBefore.visualize({bands:['B4','B3','B2'], min:0, max:3000});
  var overlayVis;

  if (TARGET_METRIC === 'EROSION') {
    overlayVis = erosionRisk.visualize({palette: ['red']});
  } else if (TARGET_METRIC === 'NDVI') {
    overlayVis = ndviChange.visualize({min:-0.3, max:0.3, palette:['red','white','green']});
  } else if (TARGET_METRIC === 'FLOOD') {
    overlayVis = floodMask.visualize({palette: ['blue']});
  } else if (TARGET_METRIC === 'RAINFALL') {
    overlayVis = highRain.visualize({palette: ['purple']});
  }

  // Text Labels
  var yearString = y.format('%04d');
  var textVisParams = {fontSize: 32, textColor: 'ffffff', outlineColor: '000000', outlineWidth: 2, outlineOpacity: 0.8};
  var rawTextImage = text.draw(yearString, textLocation, 150, textVisParams);
  var textImage = rawTextImage.select([0, 1, 2]).rename(['vis-red', 'vis-green', 'vis-blue']);
  
  // Blend everything together
  return baseVis.blend(overlayVis).blend(textImage)
    .set('year', y)
    .set('system:time_start', ee.Date.fromYMD(y, 1, 1).millis());
};

var timelapseCollection = ee.ImageCollection.fromImages(years.map(createYearlyFrame));

// ==============================
// 5. Export & Display
// ==============================
var gifParams = {
  'region': majuli.geometry(),
  'dimensions': 600,
  'crs': 'EPSG:3857',
  'framesPerSecond': 1 
};
print('Generating ' + TARGET_METRIC + ' GIF URL:', timelapseCollection.getVideoThumbURL(gifParams));

Export.video.toDrive({
  collection: timelapseCollection,
  description: 'Majuli_' + TARGET_METRIC + '_Timelapse_2018_2025',
  folder: 'EarthEngine_Exports',
  dimensions: 1080, 
  framesPerSecond: 1, 
  region: majuli.geometry()
});
