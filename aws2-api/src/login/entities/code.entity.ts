export interface CodeEntity {
  id: number;
  code: string;
  description?: string;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 간단한 인메모리 데이터베이스 (실제 프로젝트에서는 TypeORM, Prisma 등 사용)
export class InMemoryCodeDatabase {
  private codes: CodeEntity[] = [
    {
      id: 1,
      code: '3251',
      description: '기본 입장코드',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      code: '1234',
      description: '테스트 코드',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      code: 'admin',
      description: '관리자 코드',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  private nextId = 4;

  async findAll(): Promise<CodeEntity[]> {
    return [...this.codes];
  }

  async findByCode(code: string): Promise<CodeEntity | null> {
    const found = this.codes.find(c => c.code === code && c.isActive);
    if (!found) return null;
    
    // 만료 시간 체크
    if (found.expiresAt && found.expiresAt < new Date()) {
      return null;
    }
    
    return found;
  }

  async findById(id: number): Promise<CodeEntity | null> {
    return this.codes.find(c => c.id === id) || null;
  }

  async create(data: Omit<CodeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeEntity> {
    const newCode: CodeEntity = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.codes.push(newCode);
    return newCode;
  }

  async update(id: number, data: Partial<Omit<CodeEntity, 'id' | 'createdAt'>>): Promise<CodeEntity | null> {
    const index = this.codes.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.codes[index] = {
      ...this.codes[index],
      ...data,
      updatedAt: new Date(),
    };
    return this.codes[index];
  }

  async delete(id: number): Promise<boolean> {
    const index = this.codes.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.codes.splice(index, 1);
    return true;
  }
}