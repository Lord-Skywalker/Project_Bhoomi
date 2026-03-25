// ==============================
// 1. SET TARGET YEAR & LOAD AREA
// ==============================
var targetYear = 2022; 

var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 10);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

// ==============================
// 2. DYNAMIC TIME PERIODS
// ==============================
var shortBeforeStart = ee.Date.fromYMD(targetYear, 3, 1);  
var shortBeforeEnd   = ee.Date.fromYMD(targetYear, 5, 31);
var shortAfterStart  = ee.Date.fromYMD(targetYear, 8, 1);
var shortAfterEnd    = ee.Date.fromYMD(targetYear, 11, 15); 

var longBeforeStart = ee.Date.fromYMD(targetYear, 1, 1);
var longBeforeEnd   = ee.Date.fromYMD(targetYear, 6, 30);
var longAfterStart  = ee.Date.fromYMD(targetYear, 7, 1);
var longAfterEnd    = ee.Date.fromYMD(targetYear, 12, 31);

var floodRainStart = ee.Date.fromYMD(targetYear, 7, 1);
var floodRainEnd   = ee.Date.fromYMD(targetYear, 10, 15);

// ==============================
// 3. SENTINEL-2 (OPTICAL)
// ==============================
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(majuli)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70)) 
  .select(['B2','B3','B4','B8']);

var shortBefore = s2.filterDate(shortBeforeStart, shortBeforeEnd).median().clip(majuli);
var shortAfter  = s2.filterDate(shortAfterStart, shortAfterEnd).median().clip(majuli);
var longBefore  = s2.filterDate(longBeforeStart, longBeforeEnd).median().clip(majuli);
var longAfter   = s2.filterDate(longAfterStart, longAfterEnd).median().clip(majuli);

// ==============================
// 4. NDVI & VEGETATION LOSS (UPGRADED)
// ==============================
var ndviBefore = shortBefore.normalizedDifference(['B8','B4']).unmask(longBefore.normalizedDifference(['B8','B4']));
var ndviAfter = shortAfter.normalizedDifference(['B8','B4']).unmask(longAfter.normalizedDifference(['B8','B4']));
var ndviChange = ndviAfter.subtract(ndviBefore);

// STRICT threshold: Only detect massive drops in vegetation
var erosionNDVI = ndviChange.lt(-0.25).selfMask();

// ==============================
// 5. FLOOD DETECTION (SENTINEL-1)
// ==============================
var s1Image = ee.ImageCollection("COPERNICUS/S1_GRD")
  .filterBounds(majuli)
  .filterDate(floodRainStart, floodRainEnd)
  .filter(ee.Filter.eq('instrumentMode','IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV'))
  .select('VV')
  .median().clip(majuli);

var floodMask = s1Image.lt(-16).selfMask(); // Slightly tightened dB threshold

// ==============================
// 6. PERMANENT WATER MASK (NEW)
// ==============================
// Load JRC Global Surface Water to find permanent rivers/lakes
var jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(majuli);
// If water is present more than 80% of the time, consider it permanent
var permanentWater = jrc.select('occurrence').gte(80); 
// Create a mask that is ONLY land (not permanent water)
var landMask = permanentWater.unmask(0).not();

// ==============================
// 7. TERRAIN (SLOPE)
// ==============================
var dem = ee.Image("USGS/SRTMGL1_003").clip(majuli);
var slope = ee.Terrain.slope(dem);
var steepSlope = slope.gte(3).selfMask();

// ==============================
// 8. FINAL EROSION MODEL (UPGRADED)
// ==============================
// Rainfall removed from core math as Majuli rainfall is geographically uniform 
// and was artificially inflating the score everywhere.
var erosionScore = erosionNDVI.multiply(3)
  .add(floodMask.unmask(0))
  .add(steepSlope.unmask(0));

// Require a score of at least 4 (Must have severe NDVI loss + Flooding)
// AND apply the landMask so we don't count the middle of the river as "eroded"
var erosionRaw = erosionScore.gte(4).updateMask(landMask).selfMask();

// Filter out tiny isolated pixels (noise) to find real erosion clusters
var erosionRisk = erosionRaw.updateMask(erosionRaw.connectedPixelCount(3).gte(3));

// ==============================
// 9. MAP VISUALIZATION (LAYERS)
// ==============================

Map.addLayer(longBefore, {bands:['B4','B3','B2'], min:0, max:3000}, 'True Color Background');
Map.addLayer(ndviChange, {min:-0.3, max:0.3, palette:['red','white','green']}, 'NDVI Change');
Map.addLayer(erosionNDVI, {palette:['red'], opacity:0.4}, 'Vegetation Loss');
Map.addLayer(floodMask, {palette:['blue'], opacity:0.25}, 'Flood');

// FINAL RISK ZONES (Top Layer)
Map.addLayer(erosionRisk, {palette:['black'], opacity:1}, 'Erosion Risk Zones (' + targetYear + ')');
