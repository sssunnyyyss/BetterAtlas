import { useEffect, useState } from "react";

import Modal from "../ui/Modal.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

const MOBILE_NOTICE_STORAGE_KEY = "betteratlas.mobile.desktop-notice.dismissed.v1";
const MOBILE_NOTICE_QUERY = "(max-width: 1023px)";

export default function MobileDesktopNotice() {
  const isCompactViewport = useMediaQuery(MOBILE_NOTICE_QUERY);
  const [dismissed, setDismissed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(MOBILE_NOTICE_STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    } finally {
      setHydrated(true);
    }
  }, []);

  const isOpen = hydrated && isCompactViewport && !dismissed;

  function dismissNotice() {
    try {
      localStorage.setItem(MOBILE_NOTICE_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures and still close the notice for this session.
    }
    setDismissed(true);
  }

  return (
    <Modal isOpen={isOpen} title="Desktop Recommended" onClose={dismissNotice}>
      <div className="space-y-4 text-sm leading-6 text-gray-700">
        <p>
          BetterAtlas works on mobile, but the densest tools run better on desktop. On smaller
          screens, some views automatically simplify so browsing stays stable and readable.
        </p>
        <p>
          You can keep using the site on your phone, but for the full catalog comparison
          experience, schedule planning, and multi-panel workflows, use a laptop when you can.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={dismissNotice}
            className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Continue on mobile
          </button>
        </div>
      </div>
    </Modal>
  );
}
