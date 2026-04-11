// src/utils/storage.js
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error("Kayıt hatası:", error);
        }
    },
    get: (key, defaultValue) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error("Okuma hatası:", error);
            return defaultValue;
        }
    }
};

export default storage;