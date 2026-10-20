import React from 'react';
import { UniversalWarehouseTwin3D } from '../components/digitalTwin/UniversalWarehouseTwin3D';

interface SupplyDigitalTwinModuleProps {
  currentRole?: string;
}

export const SupplyDigitalTwinModule: React.FC<SupplyDigitalTwinModuleProps> = ({ currentRole: _currentRole }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <UniversalWarehouseTwin3D
        moduleScope="SUPPLY_CHAIN"
        active={true}
        className="w-full h-full"
      />
    </div>
  );
};
