import React from 'react';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import useNotificationPopups from '../../hooks/useNotificationPopups';

const NotificationPopupContainer = () => {
  const { popups, removePopup, handlePopupAction } = useNotificationPopups();

  if (popups.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {popups.map((popup, index) => (
          <div
            key={popup.popupId}
            className="pointer-events-auto"
            style={{
              transform: `translateY(${index * 10}px)`,
              zIndex: 9999 - index
            }}
          >
            <NotificationPopup
              notification={popup}
              onClose={() => removePopup(popup.popupId)}
              onAction={(action) => handlePopupAction(action, popup)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPopupContainer;