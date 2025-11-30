"""
Convert Panama shapefiles to GeoJSON for use in D3.js
 Reproject from UTM (EPSG:32617) to WGS84 lat/lon (EPSG:4326)
 Fix encoding issues with accented characters
"""
import geopandas as gpd
import pandas as pd

def read_shapefile_with_encoding(filepath):
    """Try reading shapefile with different encodings"""
    encodings = ['cp1252', 'utf-8', 'latin-1']
    for enc in encodings:
        try:
            gdf = gpd.read_file(filepath, encoding=enc)
            # Check if we got reasonable text (not all mojibake)
            text_cols = gdf.select_dtypes(include=['object']).columns
            sample_text = ' '.join([str(gdf[col].iloc[0]) for col in text_cols[:3] if gdf[col].dtype == 'object'])
            if 'Ã' not in sample_text or enc == 'utf-8':
                print(f"  Successfully read with encoding: {enc}")
                return gdf
        except Exception as e:
            continue
    # Fallback to default
    print(f"  Using default encoding (may have issues)")
    return gpd.read_file(filepath)

# Convert provinces - reproject to WGS84 (lat/lon)
print("Converting provinces...")
prov_gdf = read_shapefile_with_encoding("geo/limi_prov_a.shp")
print(f"  Original CRS: {prov_gdf.crs}")
prov_gdf = prov_gdf.to_crs("EPSG:4326")  # Convert to WGS84 lat/lon
print(f"  Converted to: {prov_gdf.crs}")

# Fix encoding in text columns - fix mojibake (UTF-8 text that was read as latin-1)
def fix_encoding(text):
    """Fix mojibake: UTF-8 text that was incorrectly decoded as latin-1"""
    if pd.isna(text) or text == 'nan' or not isinstance(text, str):
        return text
    # Check if text contains mojibake patterns (like Ã©, Ã³, etc.)
    # If it does, try to fix it
    if 'Ã' in text or any(ord(c) > 127 for c in text if ord(c) < 256):
        try:
            # Fix mojibake: encode back to latin-1 bytes, then decode as utf-8
            fixed = text.encode('latin-1').decode('utf-8')
            # Verify the fix worked (should not contain mojibake patterns)
            if 'Ã' not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        try:
            # Try cp1252 as alternative
            fixed = text.encode('cp1252').decode('utf-8')
            if 'Ã' not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    # If no mojibake detected or fix failed, return original
    return text

text_cols = prov_gdf.select_dtypes(include=['object']).columns
for col in text_cols:
    if prov_gdf[col].dtype == 'object':
        prov_gdf[col] = prov_gdf[col].apply(fix_encoding)

prov_gdf.to_file("geo/panama_provinces.geojson", driver="GeoJSON", encoding='utf-8')
print(f"Created geo/panama_provinces.geojson ({len(prov_gdf)} provinces)")

# Convert districts - reproject to WGS84
print("\nConverting districts...")
dist_gdf = read_shapefile_with_encoding("geo/limi_dist_a.shp")
print(f"  Original CRS: {dist_gdf.crs}")
dist_gdf = dist_gdf.to_crs("EPSG:4326")  # Convert to WGS84 lat/lon
print(f"  Converted to: {dist_gdf.crs}")

# Fix encoding in text columns
text_cols = dist_gdf.select_dtypes(include=['object']).columns
for col in text_cols:
    if dist_gdf[col].dtype == 'object':
        dist_gdf[col] = dist_gdf[col].apply(fix_encoding)

dist_gdf.to_file("geo/panama_districts.geojson", driver="GeoJSON", encoding='utf-8')
print(f"Created geo/panama_districts.geojson ({len(dist_gdf)} districts)")

# Convert municipalities - reproject to WGS84

corr_gdf = read_shapefile_with_encoding("geo/limi_corr_a.shp")
corr_gdf = corr_gdf.to_crs("EPSG:4326")  # Convert to WGS84 lat/lon


# Fix encoding in text columns
text_cols = corr_gdf.select_dtypes(include=['object']).columns
for col in text_cols:
    if corr_gdf[col].dtype == 'object':
        corr_gdf[col] = corr_gdf[col].apply(fix_encoding)

corr_gdf.to_file("geo/panama_municipalities.geojson", driver="GeoJSON", encoding='utf-8')
print(f"Created geo/panama_municipalities.geojson ({len(corr_gdf)} municipalities)")



