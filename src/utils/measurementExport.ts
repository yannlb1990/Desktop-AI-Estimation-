interface Measurement {
  id: string;
  measurement_type: 'linear' | 'area' | 'volume' | 'ea';
  label: string | null;
  real_value: number | null;
  real_unit: string | null;
  unit: string;
  trade: string | null;
  thickness_mm: number | null;
  volume_m3: number | null;
  points: any;
}

export const exportMeasurementsToCSV = (measurements: Measurement[], planPageId: string) => {
  const headers = ['measurement_id', 'type', 'label', 'quantity', 'unit', 'thickness_mm', 'category'];
  
  const rows = measurements.map(m => {
    let quantity = '';
    if (m.measurement_type === 'linear') quantity = (m.real_value || 0).toFixed(2);
    else if (m.measurement_type === 'area') quantity = (m.real_value || 0).toFixed(2);
    else if (m.measurement_type === 'volume') quantity = (m.volume_m3 || 0).toFixed(2);
    else if (m.measurement_type === 'ea') quantity = '1';
    
    return [
      m.id,
      m.measurement_type,
      m.label || '',
      quantity,
      m.unit,
      m.thickness_mm || '',
      m.trade || ''
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `measurements_${planPageId.slice(0, 8)}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportMeasurementsToJSON = (measurements: Measurement[], planPageId: string) => {
  const linesMeasurements = measurements.filter(m => m.measurement_type === 'linear');
  const areaMeasurements = measurements.filter(m => m.measurement_type === 'area');
  const volumeMeasurements = measurements.filter(m => m.measurement_type === 'volume');
  const eaMeasurements = measurements.filter(m => m.measurement_type === 'ea');
  
  const totalArea = areaMeasurements.reduce((sum, m) => sum + (m.real_value || 0), 0);
  const totalVolume = volumeMeasurements.reduce((sum, m) => sum + (m.volume_m3 || 0), 0);

  const exportData = {
    plan_id: planPageId,
    measurements: measurements.map(m => {
      let quantity = null;
      if (m.measurement_type === 'linear') quantity = m.real_value;
      else if (m.measurement_type === 'area') quantity = m.real_value;
      else if (m.measurement_type === 'volume') quantity = m.volume_m3;
      else if (m.measurement_type === 'ea') quantity = 1;
      
      return {
        measurement_id: m.id,
        type: m.measurement_type,
        label: m.label || '',
        quantity: quantity,
        unit: m.unit,
        thickness_mm: m.thickness_mm,
        category: m.trade || null,
        points: m.points
      };
    }),
    totals: {
      total_lines: linesMeasurements.length,
      total_areas: areaMeasurements.length,
      total_volumes: volumeMeasurements.length,
      total_ea: eaMeasurements.length,
      total_area_m2: parseFloat(totalArea.toFixed(2)),
      total_volume_m3: parseFloat(totalVolume.toFixed(2))
    }
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `measurements_${planPageId.slice(0, 8)}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
