import React from 'react';
import { TendersView } from '../TendersView';
import type { EngineMode, UserRole } from '../../types';

interface ModularTendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const TendersCalendarView: React.FC<ModularTendersViewProps> = ({ engineMode, currentRole }) => {
  return (
    <TendersView
      initialTab="calendar"
      hideTabBar={true}
      engineMode={engineMode}
      currentRole={currentRole}
    />
  );
};

export default TendersCalendarView;
