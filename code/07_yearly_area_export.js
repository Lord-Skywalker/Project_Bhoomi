// ==============================
// 1. Static Variables
// ==============================
var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");

var dem = ee.Image("USGS/SRTMGL1_003").clip(majuli);
var slope = ee.Terrain.slope(dem);
var steepSlope = slope.gte(3).selfMask();

var years = ee.List.sequence(2018, 2025);

// ==============================
// 2. The Area Calculation Function
// ==============================
var calculateYearlyArea = function(year) {
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

  // STRICT Math logic applied here
  var ndviBefore = shortBefore.normalizedDifference(['B8','B4']).unmask(longBefore.normalizedDifference(['B8','B4']));
  var ndviAfter = shortAfter.normalizedDifference(['B8','B4']).unmask(longAfter.normalizedDifference(['B8','B4']));
  var erosionNDVI = ndviAfter.subtract(ndviBefore).lt(-0.25).selfMask();

  var s1Image = ee.ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(majuli)
    .filterDate(floodRainStart, floodRainEnd)
    .filter(ee.Filter.eq('instrumentMode','IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV'))
    .select('VV')
    .median().clip(majuli);
  var floodMask = s1Image.lt(-16).selfMask();

  var jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(majuli);
  var permanentWater = jrc.select('occurrence').gte(80); 
  var landMask = permanentWater.unmask(0).not();

  var erosionScore = erosionNDVI.multiply(3)
    .add(floodMask.unmask(0)) 
    .add(steepSlope.unmask(0));
    
  var erosionRaw = erosionScore.gte(4).updateMask(landMask).selfMask();
  var erosionRisk = erosionRaw.updateMask(erosionRaw.connectedPixelCount(3).gte(3))
                              .rename('Risk_Area'); 

  // ==============================
  // 3. Area Math (Square Meters to Hectares)
  // ==============================
  var areaImage = erosionRisk.multiply(ee.Image.pixelArea());
  
  var areaStats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: majuli.geometry(),
    scale: 10, 
    maxPixels: 1e10
  });

  var areaHectares = ee.Number(areaStats.get('Risk_Area')).divide(10000);

  return ee.Feature(null, {
    'Year': y,
    'Erosion_Risk_Hectares': areaHectares
  });
};

var yearlyData = ee.FeatureCollection(years.map(calculateYearlyArea));

// ==============================
// 4. Export to CSV
// ==============================
Export.table.toDrive({
  collection: yearlyData,
  description: 'Majuli_Yearly_Erosion_Area_Loss',
  folder: 'EarthEngine_Exports',
  fileFormat: 'CSV'
});

print('Check the Tasks tab to run the CSV export!');
