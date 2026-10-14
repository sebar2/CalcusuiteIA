import React from 'react';
import { TendersView } from '../TendersView';
import type { EngineMode, UserRole } from '../../types';

interface ModularTendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const TendersBuyersView: React.FC<ModularTendersViewProps> = ({ engineMode, currentRole }) => {
  return (
    <TendersView
      initialTab="buyers"
      hideTabBar={true}
      engineMode={engineMode}
      currentRole={currentRole}
    />
  );
};

export default TendersBuyersView;
