import { IsNumber, IsString } from 'class-validator';

export class DepartementDto {
  @IsNumber()
  id: number;

  @IsString()
  code: string;

  @IsString()
  nom: string;
}
