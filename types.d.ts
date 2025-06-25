type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageUsage: number;
};

type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

type View = 'CPU' | 'RAM' | 'STORAGE';

type FrameWindowAction = 'CLOSE' | 'MAXIMIZE' | 'MINIMIZE';

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  changeView: View;
  sendFrameAction: FrameWindowAction;
};

type UnsubscribeFunction = () => void;

type BrowserViewPayload = {
  id:number
  url:string
  x:number
  y:number
  width:number
  height:number
}

interface Window {
  electron: {
    subscribeStatistics: (
      callback: (statistics: Statistics) => void
    ) => UnsubscribeFunction;
    getStaticData: () => Promise<StaticData>;
    subscribeChangeView: (
      callback: (view: View) => void
    ) => UnsubscribeFunction;
    sendFrameAction: (payload: FrameWindowAction) => void;
    createWebView: (payload: BrowserViewPayload) => void;
    resizeWebView: (payload: BrowserViewPayload) => void;
    muteWebView: (id: number, mute?: boolean) => void;
    clearBrowserViews: () => void;
  };
}
