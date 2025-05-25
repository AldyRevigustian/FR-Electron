import os

relative_path = "./folder/file.txt"
absolute_path = os.path.abspath(relative_path)

print("Path relatif:", relative_path)
print("Path absolut:", absolute_path)
