import { IsArray, IsObject } from 'class-validator';

export class ZoneAlerteVerificationDto {
  @IsArray()
  comparaisonZones: ZoneAlerteComparaisonZone[];

  @IsObject()
  comparaisonDepartement: ZoneAlerteComparaisonDepartement;
}

export interface ZoneAlerteComparaisonDepartement {
  code: string;
  percentageCover: number;
  zoneOutsideDepartement: number;
  zoneOutsideDepartementGeom: any;
  zoneEmptyDepartementGeom: any;
}

export interface ZoneAlerteComparaisonZone {
  currentCode: string;
  futurCode: string;
  areaCover: number;
  percentageCover: number;
  zoneDifference: any;
  areaDifference: any;
}
