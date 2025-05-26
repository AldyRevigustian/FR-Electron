document.addEventListener('DOMContentLoaded', async () => {
    const selectionForm = document.getElementById('selectionForm');
    const classSelect = document.getElementById('classSelect');
    const startButton = document.getElementById('startButton');
    const pythonMessages = document.getElementById('pythonMessages');

    try {
        const classSelect = document.getElementById('classSelect');
        const kelas = JSON.parse(localStorage.getItem('auth.kelas') || '[]');

        kelas.forEach(k => {
            const option = document.createElement('option');
            option.value = k.id;
            option.textContent = k.nama;
            classSelect.appendChild(option);
        });

        const token = localStorage.getItem('auth.token');
        console.log('Token:', token);

    } catch (error) {
        console.error('Gagal memuat data kelas dari store:', error);
        pythonMessages.innerHTML = `<p class="error">Gagal memuat daftar kelas: ${error.message}</p>`;
        return;
    }

    selectionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        pythonMessages.innerHTML = '';

        const selectedClassOption = classSelect.options[classSelect.selectedIndex];
        if (!selectedClassOption || !selectedClassOption.value) {
            pythonMessages.innerHTML = '<p class="error">Silakan pilih kelas terlebih dahulu!</p>';
            return;
        }

        const params = {
            classId: parseInt(selectedClassOption.value),
            className: selectedClassOption.text,
            tipeAbsen: "masuk",
        };

        console.log('Starting recognition with:', params);
        window.electronAPI.startRecognition(params);
        startButton.disabled = true;
        startButton.innerHTML = '<span>Memulai...</span>';
        pythonMessages.innerHTML = '<p class="info">Memulai proses absensi...</p>';
    });


    window.electronAPI.onPythonError((message) => {
        const p = document.createElement('p');
        p.className = 'error';
        p.textContent = `Error: ${message}`;
        pythonMessages.appendChild(p);
        startButton.disabled = false;
        startButton.innerHTML = '<span>Mulai Absensi</span>';
    });


    window.electronAPI.onRecognitionFinished((message) => {
        const p = document.createElement('p');
        p.className = 'success';
        p.textContent = message;
        pythonMessages.appendChild(p);
        startButton.disabled = false;
        startButton.innerHTML = '<span>Mulai Absensi</span>';
    });


    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllPythonErrorListeners();
        window.electronAPI.removeAllRecognitionFinishedListeners();
    });
});
