import { sendMessage } from "@/lib/messaging.ts";

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
      const res = await sendMessage("testMessage", "Hello from content script!");
      console.log(res);
      // const res = await browser.runtime.sendMessage("testMessage");
      // console.log(res);
  },
});