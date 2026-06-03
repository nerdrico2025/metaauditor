import json
import os

def split_batch_1():
    input_file = 'push_batches_small/batch_1.json'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # batch_1 has 1 file: PLANO_EXPANSAO_V2_CLICKHERO.md
    file_obj = data[0]
    content = file_obj['content']
    path = file_obj['path']
    
    # Split content in half
    mid = len(content) // 2
    part1 = content[:mid]
    part2 = content[mid:]
    
    # Create 2 new batch files
    # We will save them as "batch_1_a.json" and "batch_1_b.json"
    # But wait, we want to push them as separate FILES to github?
    # No, we want to push the SAME file "PLANO_EXPANSAO..."?
    # If we push part 1, it writes the file.
    # If we push part 2 with the SAME path, it overwrites it!
    # We cannot append via push_files.
    
    # So we MUST split the file into 2 DIFFERENT filenames.
    # e.g. PLANO_EXPANSAO_V2_CLICKHERO.part1.md and .part2.md
    
    file1 = {
        "path": path + ".part1",
        "content": part1
    }
    file2 = {
        "path": path + ".part2",
        "content": part2
    }
    
    with open('push_batches_small/batch_1_a.json', 'w', encoding='utf-8') as f:
        json.dump([file1], f)
        
    with open('push_batches_small/batch_1_b.json', 'w', encoding='utf-8') as f:
        json.dump([file2], f)
        
    print(f"Split {path} into part1 ({len(part1)}) and part2 ({len(part2)})")

if __name__ == "__main__":
    split_batch_1()
