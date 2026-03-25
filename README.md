# Project Bhoomi: Majuli Island Riverine Erosion Analysis (2018–2025)

## Overview
This repository contains a Google Earth Engine (GEE) automated workflow to dynamically model, map, and quantify riverine erosion and land degradation on Majuli Island, Assam. By integrating multi-sensor satellite imagery and climate data, this project identifies high-risk ecological zones vulnerable to the Brahmaputra River's monsoon flood cycles.

## Methodology
The core erosion model utilizes a multi-criteria heuristic approach, analyzing pre- and post-monsoon conditions for every given year. A pixel is classified as "High Erosion Risk" if it meets strict compounding thresholds across the following datasets:

1. **Vegetation Loss (Optical):** Uses Sentinel-2 (Harmonized) to calculate NDVI drop. A strict threshold (< -0.25) is applied to detect catastrophic vegetation collapse rather than seasonal agricultural harvesting.
2. **Flood Inundation (SAR):** Uses Sentinel-1 (GRD) to detect monsoon flooding (July–October) using an optimized backscatter threshold of -16 dB. 
3. **Permanent Water Masking:** Integrates the JRC Global Surface Water dataset to mask out permanent river channels (> 80% occurrence), preventing the model from classifying the normal river as eroded land.
4. **Topographical Risk (DEM):** Analyzes SRTM 30m elevation data, adjusted for floodplain micro-topography (slopes >= 1°), to identify vulnerable cut-banks and elevated sandbars.

## Repository Structure

```text
Project_Bhoomi
│
├── README.md
│
├── code
│   ├── 01_ndvi_vegetation_loss.js
│   ├── 02_flood_detection_s1.js
│   ├── 03_terrain_slope_analysis.js
│   ├── 04_rainfall_chirps.js
│   ├── 05_erosion_risk_model.js
│   ├── 06_timelapse_generator_all_metrics.js
│   └── 07_yearly_area_export.js
│
└── results
    ├── static_maps/             
    ├── timelapses/              
    └── data_exports/
        └── Majuli_Yearly_Erosion_Area_Loss.csv
