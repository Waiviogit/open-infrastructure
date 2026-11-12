import { Module } from '@nestjs/common';

import { RepositoriesModule } from '../../repositories';
import { ActivityNotesService } from './activity-notes.service';

@Module({
  imports: [RepositoriesModule],
  providers: [ActivityNotesService],
  exports: [ActivityNotesService],
})
export class ActivityNotesModule {}
