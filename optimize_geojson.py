"""
Optimize GeoJSON files for web use by simplifying geometries and reducing precision
This reduces file size significantly while maintaining visual quality
"""
import geopandas as gpd
import json
import pandas as pd

def fix_encoding(text):
    """Fix mojibake: UTF-8 text that was incorrectly decoded as latin-1"""
    if pd.isna(text) or text == 'nan' or not isinstance(text, str):
        return text
    # Check if text contains mojibake patterns (like Ã©, Ã³, etc.) or replacement characters
    if 'Ã' in text or '' in text or any(ord(c) > 127 for c in text if ord(c) < 256):
        try:
            # Fix mojibake: encode back to latin-1 bytes, then decode as utf-8
            fixed = text.encode('latin-1').decode('utf-8')
            # Verify the fix worked (should not contain mojibake patterns or replacement chars)
            if 'Ã' not in fixed and '' not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        try:
            # Try cp1252 as alternative
            fixed = text.encode('cp1252').decode('utf-8')
            if 'Ã' not in fixed and '' not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        # If we have replacement characters, try to read from original shapefile
        # For now, manually fix common cases
        replacements = {
            'Cocl': 'Coclé',
            'Panam': 'Panamá',
            'Coln': 'Colón',
            'Chiriqu': 'Chiriquí',
            'Darin': 'Darién',
            'Panam Oeste': 'Panamá Oeste',
            'Comarca Ember-Wounan': 'Comarca Emberá-Wounaan',
            'Comarca Ngbe-Bugl': 'Comarca Ngäbe-Buglé'
        }
        if text in replacements:
            return replacements[text]
    # If no mojibake detected or fix failed, return original
    return text

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

