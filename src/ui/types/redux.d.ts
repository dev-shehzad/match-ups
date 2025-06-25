export {};

declare global {
    interface Window {
        electronAPI: {
            goBack: () => void;
            goForward: () => void;
        };
    }
}
