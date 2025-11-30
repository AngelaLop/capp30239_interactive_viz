"""
Optimize GeoJSON files for web use by simplifying geometries and reducing precision
This reduces file size significantly while maintaining visual quality
"""
import geopandas as gpd
import json
import pandas as pd

def fix_encoding(text):
    """Fix encoding issues by replacing accented characters with non-accented equivalents"""
    if pd.isna(text) or text == 'nan' or not isinstance(text, str):
        return text
    
    # Replace accented characters with non-accented equivalents
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N',
        'ä': 'a', 'Ä': 'A',
        'ü': 'u', 'Ü': 'U',
    }
    
    # First, try to fix mojibake if present
    if 'Ã' in text or '' in text:
        try:
            fixed = text.encode('latin-1').decode('utf-8')
            if 'Ã' not in fixed and '' not in fixed:
                text = fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        try:
            fixed = text.encode('cp1252').decode('utf-8')
            if 'Ã' not in fixed and '' not in fixed:
                text = fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    
    # Replace any remaining accented characters or replacement characters
    result = text
    for accented, unaccented in replacements.items():
        result = result.replace(accented, unaccented)
    
    # Remove replacement characters
    result = result.replace('', '')
    
    # Manual fixes for specific cases
    if result == 'Cocl' or (result.startswith('Cocl') and len(result) <= 6):
        result = 'Cocle'
    if result == 'Panam' or (result.startswith('Panam') and 'Oeste' not in result and len(result) <= 7):
        result = 'Panama'
    if result == 'Coln' or (result.startswith('Coln') and len(result) <= 5):
        result = 'Colon'
    if result == 'Chiriqu' or (result.startswith('Chiriqu') and len(result) <= 9):
        result = 'Chiriqui'
    if result == 'Darin' or (result.startswith('Darin') and len(result) <= 7):
        result = 'Darien'
    if 'Panam' in result and 'Oeste' in result:
        result = result.replace('Panam', 'Panama')
    
    return result

def optimize_geojson(input_file, output_file, simplify_tolerance=0.0001, precision=6):
    """
    Optimize GeoJSON file by:
    - Simplifying geometries (reducing vertices)
    - Reducing coordinate precision
    - Removing unnecessary properties
    """
    print(f"Loading {input_file}...")
    gdf = gpd.read_file(input_file, encoding='utf-8')
    
    # Fix encoding in text columns
    print("Fixing encoding issues...")
    text_cols = gdf.select_dtypes(include=['object']).columns
    for col in text_cols:
        if gdf[col].dtype == 'object':
            gdf[col] = gdf[col].apply(fix_encoding)
    
    print(f"Original: {len(gdf)} features, {gdf.crs}")
    original_size = gdf.memory_usage(deep=True).sum() / (1024 * 1024)
    print(f"Original size: ~{original_size:.2f} MB in memory")
    
    # Simplify geometries (reduces vertices while maintaining shape)
    print("Simplifying geometries...")
    gdf['geometry'] = gdf.geometry.simplify(tolerance=simplify_tolerance, preserve_topology=True)
    
    # Convert to GeoJSON with reduced precision
    print(f"Writing optimized file to {output_file}...")
    
    # Use to_file with driver='GeoJSON' and UTF-8 encoding
    gdf.to_file(output_file, driver='GeoJSON', encoding='utf-8')
    
    # Further optimize by reading and rewriting with reduced precision
    with open(output_file, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)
    
    # Reduce coordinate precision
    def reduce_precision(coords, precision):
        if isinstance(coords[0], (list, tuple)):
            return [reduce_precision(coord, precision) for coord in coords]
        else:
            return [round(coord, precision) for coord in coords]
    
    if 'features' in geojson_data:
        for feature in geojson_data['features']:
            if 'geometry' in feature and 'coordinates' in feature['geometry']:
                feature['geometry']['coordinates'] = reduce_precision(
                    feature['geometry']['coordinates'], precision
                )
    
    # Write optimized version with UTF-8 encoding
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, separators=(',', ':'), ensure_ascii=False)  # No spaces, preserve Unicode
    
    # Check file size
    import os
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"Optimized file size: {file_size_mb:.2f} MB")
    print(f"Size reduction: {((1 - file_size_mb / (original_size * 10)) * 100):.1f}%")  # Rough estimate
    
    return file_size_mb

if __name__ == "__main__":
    # Optimize municipalities (largest file)
    print("=" * 60)
    print("Optimizing panama_municipalities.geojson")
    print("=" * 60)
    size1 = optimize_geojson(
        "geo/panama_municipalities.geojson",
        "geo/panama_municipalities.geojson",  # Overwrite original
        simplify_tolerance=0.0001,  # Adjust based on needs
        precision=5  # 5 decimal places (~1 meter precision)
    )
    
    # Optimize provinces
    print("\n" + "=" * 60)
    print("Optimizing panama_provinces.geojson")
    print("=" * 60)
    size2 = optimize_geojson(
        "geo/panama_provinces.geojson",
        "geo/panama_provinces.geojson",  # Overwrite original
        simplify_tolerance=0.0001,
        precision=5
    )
    
    # Optimize districts
    print("\n" + "=" * 60)
    print("Optimizing panama_districts.geojson")
    print("=" * 60)
    size3 = optimize_geojson(
        "geo/panama_districts.geojson",
        "geo/panama_districts.geojson",  # Overwrite original
        simplify_tolerance=0.0001,
        precision=5
    )
    
    print("\n" + "=" * 60)
    print("Optimization complete!")
    print(f"Total optimized size: {size1 + size2 + size3:.2f} MB")
    print("=" * 60)
    print("\nIf optimized files are under 50MB each, you can:")
    print("1. Remove them from Git LFS")
    print("2. Commit them directly to git")
    print("3. Update map.js to use the optimized files")

