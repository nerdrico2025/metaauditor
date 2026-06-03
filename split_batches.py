import json
import os

MAX_BATCH_SIZE = 30000  # 30KB to stay well within token limits

def split_batches():
    input_dir = 'push_batches'
    output_dir = 'push_batches_small'
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Get all batch files
    files = [f for f in os.listdir(input_dir) if f.startswith('batch_') and f.endswith('.json')]
    files.sort(key=lambda x: int(x.split('_')[1].split('.')[0]))
    
    current_batch = []
    current_size = 0
    batch_counter = 0
    
    for filename in files:
        filepath = os.path.join(input_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                batch_files = json.load(f)
            except json.JSONDecodeError:
                print(f"Error decoding {filename}, skipping")
                continue
                
            for file_obj in batch_files:
                content_len = len(json.dumps(file_obj))
                
                # If a single file is too big, we have to put it in its own batch
                # (and hope it's not > limit, if it is, we might need other strategies, 
                # but for now assume files < 50KB individually)
                if content_len > MAX_BATCH_SIZE:
                    # Flush current batch if not empty
                    if current_batch:
                        save_batch(output_dir, batch_counter, current_batch)
                        batch_counter += 1
                        current_batch = []
                        current_size = 0
                    
                    # Save big file as single batch
                    save_batch(output_dir, batch_counter, [file_obj])
                    batch_counter += 1
                    continue
                
                if current_size + content_len > MAX_BATCH_SIZE:
                    save_batch(output_dir, batch_counter, current_batch)
                    batch_counter += 1
                    current_batch = []
                    current_size = 0
                
                current_batch.append(file_obj)
                current_size += content_len
    
    # Save last batch
    if current_batch:
        save_batch(output_dir, batch_counter, current_batch)

def save_batch(directory, index, content):
    filename = f"batch_{index}.json"
    with open(os.path.join(directory, filename), 'w', encoding='utf-8') as f:
        json.dump(content, f)
    print(f"Saved {filename} with size {len(json.dumps(content))} bytes")

if __name__ == "__main__":
    split_batches()
