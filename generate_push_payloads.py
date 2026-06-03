import os
import subprocess
import json
import base64

def get_files():
    result = subprocess.run(['git', 'ls-files'], capture_output=True, text=True, cwd=os.getcwd())
    return [f for f in result.stdout.splitlines() if f.strip()]

def read_file_content(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        # Binary file, skip or encode?
        # For simplicity, let's skip binary files for now, or handle images if critical.
        # Most web assets like images might be binary.
        # skip for now to avoid issues with string-based content field.
        return None

def main():
    files = get_files()
    batch_size = 5
    batches = [files[i:i + batch_size] for i in range(0, len(files), batch_size)]

    output_dir = 'push_batches'
    os.makedirs(output_dir, exist_ok=True)

    for i, batch in enumerate(batches):
        payload_files = []
        for file_path in batch:
            if not os.path.exists(file_path):
                continue
            
            content = read_file_content(file_path)
            if content is not None:
                payload_files.append({
                    "path": file_path,
                    "content": content
                })
        
        if payload_files:
            output_file = os.path.join(output_dir, f'batch_{i}.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(payload_files, f)
            print(f"Created {output_file} with {len(payload_files)} files")

if __name__ == '__main__':
    main()
