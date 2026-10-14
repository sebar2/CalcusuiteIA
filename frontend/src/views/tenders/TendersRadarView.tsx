import React from 'react';
import { TendersView } from '../TendersView';
import type { EngineMode, UserRole } from '../../types';

interface ModularTendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const TendersRadarView: React.FC<ModularTendersViewProps> = ({ engineMode, currentRole }) => {
  return (
    <TendersView
      initialTab="radar"
      hideTabBar={false}
      engineMode={engineMode}
      currentRole={currentRole}
    />
  );
};

export default TendersRadarView;
