import { IApp } from "./app";

export class AppManager {
    static app: IApp;

    static gracefulShutdown: (shutdownMsg: string, isStandalone: boolean) => Promise<any> = (shutdownMsg: string, isStandalone: boolean) => {
        const disconnectPromise = AppManager.app.closeDataBaseConnection();
        if (isStandalone) {
            disconnectPromise.then(() => {
                console.error('database disconnect resolved');
                const shutdownPromise: Promise<boolean> = AppManager.app.shutdown();
                shutdownPromise.then(() => {
                    console.error(shutdownMsg);
                    console.error('process.exit()');
                    process.exit(0);
                });
                shutdownPromise.catch((err: any) => {
                    console.error(err);
                    console.error('process.exit()');
                    process.exit(1);
                });
            });
            disconnectPromise.catch((rejectionReason: any) => {
                console.error('database disconnect rejected with');
                if (rejectionReason) {
                    console.error(rejectionReason.toString());
                    console.error(JSON.stringify(rejectionReason));
                }
                const shutdownPromise: Promise<boolean> = AppManager.app.shutdown();
                shutdownPromise.then(() => {
                    console.error(shutdownMsg);
                    console.error('process.exit()');
                    process.exit(2);
                });
                shutdownPromise.catch((err: any) => {
                    console.error(err);
                    console.error('process.exit()');
                    process.exit(3);
                });    
            });
        } else {
            disconnectPromise.then(() => {
                process.exit(0);
            });
            disconnectPromise.then(() => {
                process.exit(4);
            });
        }
        return disconnectPromise;
    }

    public static registerAppClosingEvent(app: IApp, isStandalone: boolean) {
        AppManager.app = app;
        if (isStandalone) {
            // https://nodejs.org/api/process.html#process_signal_events
            process.on('SIGINT', () => {
                AppManager.gracefulShutdown('SIGINT: CTRL+ C -> graceful shutdown completed -> process.exit()', isStandalone);
            });

            process.on('SIGHUP', () => {
                AppManager.gracefulShutdown('SIGHUP: window is closed -> graceful shutdown completed -> process.exit()', isStandalone);
            });
        }
    }
}