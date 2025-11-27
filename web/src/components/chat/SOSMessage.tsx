/**
 * SOS Message Component
 * Displays SOS messages with visual distinction
 */

import type { Message } from '../../domain/message';

export interface SOSMessageProps {
  /** SOS message to display */
  message: Message;
  /** Whether this message is from current user */
  isOwn?: boolean;
}

const SOS_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Emergency',
  flood: 'Flood Emergency',
  fire: 'Fire Emergency',
  missing_person: 'Missing Person',
};

const SOS_TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  flood: '🌊',
  fire: '🔥',
  missing_person: '👤',
};

/**
 * SOS Message component
 * Displays SOS messages with prominent visual styling
 */
export function SOSMessage({ message, isOwn = false }: SOSMessageProps) {
  if (message.message_type !== 'sos' || !message.sos_type) {
    return null;
  }

  const sosType = message.sos_type;
  const sosLabel = SOS_TYPE_LABELS[sosType] || 'Emergency';
  const sosIcon = SOS_TYPE_ICONS[sosType] || '🚨';

  return (
    <div className={`sos-message ${isOwn ? 'sos-message--own' : ''}`}>
      <div className="sos-message-header">
        <span className="sos-message-icon">{sosIcon}</span>
        <span className="sos-message-type">{sosLabel}</span>
        <span className="sos-message-badge">URGENT</span>
      </div>
      <div className="sos-message-content">{message.content}</div>
      <div className="sos-message-footer">
        <span className="sos-message-timestamp">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

