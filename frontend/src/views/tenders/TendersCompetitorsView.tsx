import React from 'react';
import { TendersView } from '../TendersView';
import type { EngineMode, UserRole } from '../../types';

interface ModularTendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const TendersCompetitorsView: React.FC<ModularTendersViewProps> = ({ engineMode, currentRole }) => {
  return (
    <TendersView
      initialTab="competitors"
      hideTabBar={false}
      engineMode={engineMode}
      currentRole={currentRole}
    />
  );
};

export default TendersCompetitorsView;
