// ==============================
// 04. CHIRPS MONSOON RAINFALL
// ==============================
var targetYear = 2022; 

var majuli = ee.FeatureCollection("users/debanubhav/Majuli_Boundary_Owned");
Map.centerObject(majuli, 10);
Map.addLayer(majuli.style({color: 'blue', fillColor: '00000000', width: 2}), {}, "Boundary");

// Monsoon Dates
var floodRainStart = ee.Date.fromYMD(targetYear, 7, 1);
var floodRainEnd   = ee.Date.fromYMD(targetYear, 10, 15);

// Climate Data (CHIRPS Daily)
var rainfall = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
  .filterBounds(majuli)
  .filterDate(floodRainStart, floodRainEnd)
  .sum().clip(majuli); // Sum the total precipitation over the season

// Threshold for extreme rain
var highRain = rainfall.gt(600).selfMask();

// Visualization
// Show a heat map of total seasonal rainfall
Map.addLayer(rainfall, {
  min: 400, max: 1000, 
  palette: ['white', 'lightblue', 'blue', 'darkblue', 'purple']
}, 'Total Rainfall Heatmap');

// Highlight the areas that broke the 600mm threshold
Map.addLayer(highRain, {palette: ['magenta'], opacity: 0.5}, 'Extreme Rainfall > 600mm (' + targetYear + ')', false);
