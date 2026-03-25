// ==============================
// 02. SENTINEL-1 FLOOD INUNDATION
// ==============================
var targetYear = 2022; 

var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 10);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

// Monsoon Dates
var floodRainStart = ee.Date.fromYMD(targetYear, 7, 1);
var floodRainEnd   = ee.Date.fromYMD(targetYear, 10, 15);

// Radar Data (Sentinel-1)
var s1Image = ee.ImageCollection("COPERNICUS/S1_GRD")
  .filterBounds(majuli)
  .filterDate(floodRainStart, floodRainEnd)
  .filter(ee.Filter.eq('instrumentMode','IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV'))
  .select('VV')
  .median().clip(majuli);

// Water Threshold (-16 dB)
var allWater = s1Image.lt(-16).selfMask();

// Permanent Water vs Flood Separation
var jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(majuli);
var permanentWater = jrc.select('occurrence').gte(80).selfMask(); 
var landMask = jrc.select('occurrence').lt(80);
var newFlooding = allWater.updateMask(landMask);

// Visualization
Map.addLayer(s1Image, {min: -25, max: 0}, 'Raw S1 Radar', false);
Map.addLayer(permanentWater, {palette: ['darkblue'], opacity: 0.6}, 'Permanent River/Lakes');
Map.addLayer(newFlooding, {palette: ['cyan'], opacity: 0.8}, 'Monsoon Flooding (' + targetYear + ')');
