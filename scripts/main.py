import warnings
from face_recognition_system import FaceRecognitionSystem


def main():
    warnings.filterwarnings("ignore", category=FutureWarning)
    try:
        system = FaceRecognitionSystem()
        system.run()

    except KeyboardInterrupt:
        print("\nProgram terminated by user")
    except Exception as e:
        print(f"An error occurred: {str(e)}")
    finally:
        if "system" in locals():
            system.cleanup()


if __name__ == "__main__":
    main()
