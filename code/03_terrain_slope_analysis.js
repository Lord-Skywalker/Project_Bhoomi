// ==============================
// 03. TOPOGRAPHICAL SLOPE RISK (FLOODPLAIN ADJUSTED)
// ==============================
var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 11);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

// Elevation Data (SRTM 30m)
var dem = ee.Image("USGS/SRTMGL1_003").clip(majuli);

// Slope Math
var slope = ee.Terrain.slope(dem);

// Isolate Risk Slopes
// Lowered the threshold to 1 degree to capture the slight riverbank gradients
var steepSlope = slope.gte(1).selfMask();

// Visualization
// Hyper-tightened elevation range (60m to 90m) to force visual contrast on flat land
Map.addLayer(dem, {
  min: 60, max: 90, 
  palette: ['black', 'darkgray', 'lightgray', 'white']
}, 'Elevation (DEM)', false);

// Tightened slope visualization to highlight micro-gradients (0 to 2 degrees)
Map.addLayer(slope, {
  min: 0, max: 2, 
  palette: ['green', 'yellow', 'red']
}, 'Slope Gradient Map', false);

// Highlight the risky areas
Map.addLayer(steepSlope, {
  palette: ['orange'], 
  opacity: 0.8
}, 'High Risk Slopes (>= 1°)');
