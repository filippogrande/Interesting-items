#!/usr/bin/env python3
import os
from aliexpress import extract_variants_from_html


def main():
    pid = '1005009923595931'
    html_path = os.path.join('tmp', f'aliexpress_{pid}_rendered.html')
    if not os.path.exists(html_path):
        print('HTML renderizzato non trovato:', html_path)
        return 2
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    variants = extract_variants_from_html(html)
    if not variants or (not variants.get('variants') and not variants.get('attributes')):
        print('Nessuna variante trovata.')
        return 0

    yaml_path = os.path.join('storage', f'aliexpress_{pid}.yaml')
    os.makedirs('storage', exist_ok=True)
    with open(yaml_path, 'w', encoding='utf-8') as yf:
        def write_yaml(obj, indent=0):
            pad = '  ' * indent
            if isinstance(obj, dict):
                for k, v in obj.items():
                    yf.write(f"{pad}{k}:\n")
                    write_yaml(v, indent + 1)
            elif isinstance(obj, list):
                for item in obj:
                    yf.write(f"{pad}- ")
                    if isinstance(item, (dict, list)):
                        yf.write('\n')
                        write_yaml(item, indent + 1)
                    else:
                        yf.write(f"{item}\n")
            else:
                yf.write(f"{pad}{obj}\n")
        write_yaml(variants)

    print('Varianti estratte e salvate in', yaml_path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
