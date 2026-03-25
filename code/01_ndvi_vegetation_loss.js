// ==============================
// 01. NDVI VEGETATION LOSS MAPPING
// ==============================
var targetYear = 2022; 

var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 10);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

// Dates
var shortBeforeStart = ee.Date.fromYMD(targetYear, 3, 1);  
var shortBeforeEnd   = ee.Date.fromYMD(targetYear, 5, 31);
var shortAfterStart  = ee.Date.fromYMD(targetYear, 8, 1);
var shortAfterEnd    = ee.Date.fromYMD(targetYear, 11, 15); 
var longBeforeStart  = ee.Date.fromYMD(targetYear, 1, 1);
var longBeforeEnd    = ee.Date.fromYMD(targetYear, 6, 30);
var longAfterStart   = ee.Date.fromYMD(targetYear, 7, 1);
var longAfterEnd     = ee.Date.fromYMD(targetYear, 12, 31);

// Optical Data (Sentinel-2)
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(majuli)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70)) 
  .select(['B2','B3','B4','B8']);

var shortBefore = s2.filterDate(shortBeforeStart, shortBeforeEnd).median().clip(majuli);
var shortAfter  = s2.filterDate(shortAfterStart, shortAfterEnd).median().clip(majuli);
var longBefore  = s2.filterDate(longBeforeStart, longBeforeEnd).median().clip(majuli);
var longAfter   = s2.filterDate(longAfterStart, longAfterEnd).median().clip(majuli);

// NDVI Math
var ndviBefore = shortBefore.normalizedDifference(['B8','B4']).unmask(longBefore.normalizedDifference(['B8','B4']));
var ndviAfter = shortAfter.normalizedDifference(['B8','B4']).unmask(longAfter.normalizedDifference(['B8','B4']));
var ndviChange = ndviAfter.subtract(ndviBefore);

// Stricter Threshold: Look for major vegetation collapse
var severeLoss = ndviChange.lt(-0.25).selfMask();

// Visualization
Map.addLayer(longBefore, {bands:['B4','B3','B2'], min:0, max:3000}, 'True Color (Pre-Monsoon)');
Map.addLayer(ndviChange, {min:-0.3, max:0.3, palette:['red','white','green']}, 'NDVI Change Index', false);
Map.addLayer(severeLoss, {palette:['red'], opacity:0.8}, 'Severe Vegetation Loss (' + targetYear + ')');
