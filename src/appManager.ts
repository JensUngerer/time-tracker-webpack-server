import App, { IApp } from './app';
import { shutdown } from 'log4js';

export class AppManager {
  static app: IApp;

  static gracefulShutdown(shutdownMsg: string, isStandalone: boolean) {
    const disconnectPromise = AppManager.app.closeDataBaseConnection();
    if (isStandalone) {
      disconnectPromise.then(() => {
        App.logger.error('database disconnect resolved');
        const shutdownPromise: Promise<boolean> = AppManager.app.shutdown();
        shutdownPromise.then(() => {
          App.logger.error(shutdownMsg);
          App.logger.error('process.exit()');
          shutdown(() => {
            process.exit(0);
          });
        });
        shutdownPromise.catch((err: any) => {
          App.logger.error(err);
          App.logger.error('process.exit()');
          shutdown(() => {
            process.exit(1);
          });
        });
      });
      disconnectPromise.catch((rejectionReason: any) => {
        App.logger.error('database disconnect rejected with');
        if (rejectionReason) {
          App.logger.error(rejectionReason.toString());
          App.logger.error(JSON.stringify(rejectionReason));
        }
        const shutdownPromise: Promise<boolean> = AppManager.app.shutdown();
        shutdownPromise.then(() => {
          App.logger.error(shutdownMsg);
          App.logger.error('process.exit()');
          shutdown(() => {
            process.exit(2);
          });
        });
        shutdownPromise.catch((err: any) => {
          App.logger.error(err);
          App.logger.error('process.exit()');
          shutdown(() => {
            process.exit(3);
          });
        });
      });
    } else {
      disconnectPromise.then(() => {
        shutdown(() => {
          process.exit(0);
        });
      });
      disconnectPromise.then(() => {
        shutdown(() => {
          process.exit(4);
        });
      });
    }
    // return disconnectPromise;
  }

  public static registerAppClosingEvent(app: IApp, isStandalone: boolean) {
    AppManager.app = app;
    if (isStandalone) {
      // https://nodejs.org/api/process.html#process_signal_events
      const SIGINT = 'SIGINT';
      const sigIntCallback = () => {
        process.off(SIGINT, sigIntCallback);

        // DEBUGGING:
        App.logger.error(SIGINT + ' event removed');

        AppManager.gracefulShutdown('SIGINT: CTRL+ C -> graceful shutdown completed -> process.exit()', isStandalone);
      };

      process.on(SIGINT, sigIntCallback);

      const SIGHUP = 'SIGHUP';
      const sigHupCallback = () => {
        process.off(SIGHUP, sigHupCallback);

        // DEBUGGING:
        App.logger.error(SIGHUP + ' event removed');

        AppManager.gracefulShutdown('SIGHUP: window is closed -> graceful shutdown completed -> process.exit()', isStandalone);
      };

      process.on(SIGHUP, sigHupCallback);
    }
  }
}
