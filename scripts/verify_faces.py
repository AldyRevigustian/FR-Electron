import sys
import json
from facenet_pytorch import MTCNN
from PIL import Image


mtcnn = MTCNN()

def detect_faces(image_path):
    image = Image.open(image_path)
    if image.mode != "RGB":
        image = image.convert("RGB")
    boxes, _ = mtcnn.detect(image)
    return boxes is not None and len(boxes) > 0

if __name__ == "__main__":
    files = sys.argv[1:]
    results = []

    for file in files:
        has_face = detect_faces(file)
        results.append(has_face)

    success = all(results)
    print(json.dumps({"success": success, "details": results}))
