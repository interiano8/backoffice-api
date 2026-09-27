import { Module, Global } from "@nestjs/common";
import { PgConnectionFactory } from "./pg-connection-factory";
import { PrismaModule } from "../../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    PgConnectionFactory,
    { provide: "IConnectionFactory", useClass: PgConnectionFactory },
  ],
  exports: ["IConnectionFactory", PgConnectionFactory],
})
export class ConnectionsModule {}
