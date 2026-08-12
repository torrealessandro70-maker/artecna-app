import type {
  CadEntity,
  CadEntityId,
} from "../entities";

export interface CadCommandResult {
  entities: CadEntity[];

  changed: boolean;

  createdEntityIds?: CadEntityId[];

  removedEntityIds?: CadEntityId[];

  updatedEntityIds?: CadEntityId[];
}