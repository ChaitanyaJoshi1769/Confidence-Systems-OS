import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evidence } from './entities/evidence.entity';
import { EvidencePacket } from './entities/evidence-packet.entity';
import { ReplayEvent } from './entities/replay-event.entity';
import { EvidenceService } from './services/evidence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Evidence, EvidencePacket, ReplayEvent])],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
