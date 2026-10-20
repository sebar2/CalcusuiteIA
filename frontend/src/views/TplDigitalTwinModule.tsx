import React from 'react';
import { UniversalWarehouseTwin3D } from '../components/digitalTwin/UniversalWarehouseTwin3D';

interface TplDigitalTwinModuleProps {
  currentRole?: string;
}

export const TplDigitalTwinModule: React.FC<TplDigitalTwinModuleProps> = ({ currentRole: _currentRole }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <UniversalWarehouseTwin3D
        moduleScope="3PL"
        active={true}
        className="w-full h-full"
      />
    </div>
  );
};
