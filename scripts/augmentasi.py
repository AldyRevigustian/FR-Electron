import os
from PIL import Image
from facenet_pytorch import MTCNN
import numpy as np
from imgaug import augmenters as iaa
import shutil
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

detector = MTCNN(device=device)
seq = iaa.Sequential(
    [
        iaa.Fliplr(0.5),  # Horizontal flip
        iaa.Affine(rotate=(-30, 30)),  # Rotasi wajah
        iaa.LinearContrast((0.9, 1.1)),  # Kontras
        iaa.Multiply((0.8, 1.2)),  # Kecerahan
        iaa.Grayscale(alpha=(0.0, 1.0)),  # Grayscale
        iaa.AdditiveGaussianNoise(scale=(0, 0.05 * 255)),  # Noise ringan
        iaa.AddToHueAndSaturation((-10, 10)),  # Hue dan Saturasi
        iaa.MultiplyHueAndSaturation((0.8, 1.2)),  # Jitter warna
    ]
)

dataset_dir = os.path.abspath("../scripts/Images")
output_dir = os.path.abspath("../scripts/Images/Augmented_Images/")

def detect_and_crop_face(image_path):
    img = Image.open(image_path)
    if img.mode != "RGB":
        img = img.convert("RGB")

    img_rgb = np.array(img)

    boxes, probs = detector.detect(img_rgb)

    if boxes is not None and len(boxes) > 0:
        box = boxes[0]
        x_min, y_min, x_max, y_max = map(int, box)
        img_cropped = img.crop((x_min, y_min, x_max, y_max))
        img_cropped = img_cropped.resize((160, 160))
        return img_cropped
    else:
        return None


def crop_profile(image_path, padding=0.5):
    img = Image.open(image_path)
    if img.mode != "RGB":
        img = img.convert("RGB")

    img_rgb = np.array(img)
    boxes, probs = detector.detect(img_rgb)

    if boxes is not None and len(boxes) > 0:
        box = boxes[0]
        x_min, y_min, x_max, y_max = map(int, box)

        width = x_max - x_min
        height = y_max - y_min
        pad_x = int(padding * width)
        pad_y = int(padding * height)

        x_min = max(0, x_min - pad_x)
        y_min = max(0, y_min - pad_y)
        x_max = min(img.width, x_max + pad_x)
        y_max = min(img.height, y_max + pad_y)

        img_cropped = img.crop((x_min, y_min, x_max, y_max))
        img_cropped = img_cropped.resize((370, 370))

        img_cropped_rgb = np.array(img_cropped)
        boxes_cropped, probs_cropped = detector.detect(img_cropped_rgb)

        if boxes_cropped is None or len(boxes_cropped) == 0:
            return None

        print("Wajah terdeteksi")
        return img_cropped
    else:
        return None


def save_profile(person_name):
    person_folder = os.path.join(dataset_dir, person_name)
    images = [f for f in os.listdir(person_folder) if f.endswith(".jpg")]

    for image_filename in images:
        image_path = os.path.join(person_folder, image_filename)
        cropped = crop_profile(image_path)
        if cropped is not None:
            cropped.save(os.path.join(person_folder, "profile.jpg"))
            break


def augment_and_save(face, person_name, base_filename, num_augments=10):
    person_folder = os.path.join(output_dir, person_name)
    if not os.path.exists(person_folder):
        os.makedirs(person_folder)

    original_filename = os.path.join(person_folder, f"{base_filename}_original.jpg")
    face.save(original_filename)

    for i in range(num_augments):
        augmented_face = seq(image=np.array(face))

        if augmented_face is None or augmented_face.size == 0:
            print(
                f"Warning: Gambar kosong setelah augmentasi untuk {base_filename}_aug_{i+1}"
            )
            continue

        augmented_image = Image.fromarray(augmented_face)
        augmented_image = augmented_image.convert("RGB")

        new_filename = os.path.join(person_folder, f"{base_filename}_aug_{i+1}.jpg")

        try:
            augmented_image.save(new_filename)
        except ValueError as e:
            print(f"Error: Tidak dapat menyimpan gambar {new_filename} - {e}")

        if not detect_face(new_filename):
            print(
                f"Warning: Wajah tidak terdeteksi pada {new_filename}, menghapus gambar."
            )
            os.remove(new_filename)


def detect_face(image_path):
    img = Image.open(image_path)
    img_rgb = np.array(img)

    boxes, probs = detector.detect(img_rgb)

    if boxes is not None and len(boxes) > 0:
        return True
    else:
        return False


def process_person_images(person_name):
    person_folder = os.path.join(dataset_dir, person_name)
    images = [f for f in os.listdir(person_folder) if f.endswith(".jpg")]

    for image_filename in images:
        if image_filename == "profile.jpg":
            continue
        image_path = os.path.join(person_folder, image_filename)
        face = detect_and_crop_face(image_path)

        if face is not None:
            base_filename = image_filename.split(".")[0]
            augment_and_save(face, person_name, base_filename)


def delete_images_without_faces(dataset_path):
    for person_name in os.listdir(dataset_path):
        person_folder = os.path.join(dataset_path, person_name)
        if os.path.isdir(person_folder):
            for img_name in os.listdir(person_folder):
                img_path = os.path.join(person_folder, img_name)
                try:
                    img = Image.open(img_path).convert("RGB")
                    faces, _ = detector(img, return_prob=True)
                    if faces is None or len(faces) == 0:
                        print(f"Deleting {img_path} - No face detected.")
                        os.remove(img_path)
                except Exception as e:
                    print(f"Error processing {img_path}: {e}")
    print("Deleting selesai.")


if not os.path.exists(output_dir):
    os.makedirs(output_dir)
else:
    shutil.rmtree(output_dir)
    os.makedirs(output_dir)
    print(f"Direktori {output_dir} beserta isinya berhasil dihapus.")

for person_name in os.listdir(dataset_dir):
    person_folder = os.path.join(dataset_dir, person_name)
    if os.path.isdir(person_folder):
        print(person_name)
        process_person_images(person_name)
        save_profile(person_name)

delete_images_without_faces(output_dir)
print("Augmentasi selesai.")
