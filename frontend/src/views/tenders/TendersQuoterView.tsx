import React from 'react';
import { TendersView } from '../TendersView';
import type { EngineMode, UserRole } from '../../types';

interface ModularTendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const TendersQuoterView: React.FC<ModularTendersViewProps> = ({ engineMode, currentRole }) => {
  return (
    <TendersView
      initialTab="cotizador"
      hideTabBar={false}
      engineMode={engineMode}
      currentRole={currentRole}
    />
  );
};

export default TendersQuoterView;
