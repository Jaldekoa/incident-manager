import { broadcast, sendToBackground, type OffscreenRequest, type OffscreenResponse } from '../shared/messages';
import { errorMessage } from '../shared/errors';
import { enqueueCaptureOperation, preloadModel, startCapture, stopCapture } from './capture';

function respond(promise: Promise<unknown>, sendResponse: (response: OffscreenResponse) => void): true {
  promise.then(() => sendResponse({ ok: true }), (error) => sendResponse({ ok: false, error: errorMessage(error) }));
  return true;
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;
  switch (message.type) {
    case 'PING':
      sendResponse({ ok: true });
      return false;
    case 'START_CAPTURE':
      return respond(enqueueCaptureOperation(() => startCapture(message.streamId)).catch(async (error) => {
        await sendToBackground({ type: 'CAPTURE_STATE', capturing: false, error: errorMessage(error) });
        throw error;
      }), sendResponse);
    case 'STOP_CAPTURE':
      return respond(enqueueCaptureOperation(() => stopCapture()), sendResponse);
    case 'PRELOAD_MODEL':
      preloadModel(message.model)
        .then(() => broadcast({ type: 'PRELOAD_DONE' }))
        .catch((error) => broadcast({ type: 'PRELOAD_FAILED', error: errorMessage(error) }));
      return false;
  }
  return false;
});
