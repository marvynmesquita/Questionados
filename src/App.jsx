import React, { useState, useRef, useEffect, useMemo } from 'react'
import Groq from 'groq-sdk'
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc } from './firebase'
import { customAlphabet } from 'nanoid'

// Ícones (Misturando FontAwesome para UI geral)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faFlask,
  faFutbol,
  faGlobe,
  faTicket,
  faLandmark,
  faUserGroup,
  faBrain,
  faTrophy,
  faTimesCircle,
  faCheckCircle,
  faLightbulb
} from '@fortawesome/free-solid-svg-icons'

// Gerador de IDs curtos para salas
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

// --- CONFIGURAÇÃO DAS CATEGORIAS (Estilo Visual da Main) ---
const categories = [
  {
    id: 'art',
    name: 'Arte',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: faPalette,
    description: 'Pintura, Literatura e Música'
  },
  {
    id: 'science',
    name: 'Ciência',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    icon: faFlask,
    description: 'Biologia, Química e Física'
  },
  {
    id: 'sports',
    name: 'Esporte',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: faFutbol,
    description: 'Futebol, Olimpíadas e Atletas'
  },
  {
    id: 'geography',
    name: 'Geografia',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600', // Um pouco mais escuro para leitura
    icon: faGlobe,
    description: 'Países, Capitais e Mapas'
  },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    color: 'bg-pink-500',
    textColor: 'text-pink-500',
    icon: faTicket,
    description: 'Cinema, Séries e Pop Culture'
  },
  {
    id: 'history',
    name: 'História',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: faLandmark,
    description: 'Eventos, Datas e Figuras Históricas'
  }
]

export default function App () {
  // --- ESTADOS LOCAIS (UI) ---
  const [playerName, setPlayerName] = useState('')
  const [gameId, setGameId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState(null)

  // --- ESTADO DO JOGO (Sync Firebase) ---
  const [gameData, setGameData] = useState(null)

  // Estados Visuais e Lógica Local
  const [spinningIndex, setSpinningIndex] = useState(0)
  const [localGameState, setLocalGameState] = useState('versus-menu')
  const [localQuestion, setLocalQuestion] = useState(null)
  const [localResult, setLocalResult] = useState(null)

  // Placar Solo (caso jogue offline/sozinho na branch versus)
  const [soloScores, setSoloScores] = useState({
    art: 0,
    science: 0,
    sports: 0,
    geography: 0,
    entertainment: 0,
    history: 0
  })

  const spinIntervalRef = useRef(null)

  // --- API KEY GROQ ---
  const rawApiKey = process.env.REACT_APP_GROQ_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setApiKey(null)
    } else {
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  const groqClient = useMemo(() => {
    if (apiKey) {
      return new Groq({ apiKey: apiKey, dangerouslyAllowBrowser: true })
    }
    return null
  }, [apiKey])

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)
    }
  }, [])

  // --- SINCRONIZAÇÃO COM FIREBASE (Lógica do Modo Versus) ---
  useEffect(() => {
    if (!gameId) return

    const cleanGameId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanGameId)

    const unsubscribe = onSnapshot(
      gameRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setGameData(data)

          // Prioridade de Estados para manter a UI sincronizada
          if (data.currentQuestion && data.gameState === 'question') {
            if (
              data.currentQuestion.pergunta !== localQuestion?.pergunta ||
              localGameState !== 'question'
            ) {
              if (spinIntervalRef.current)
                clearInterval(spinIntervalRef.current)
              setLocalQuestion(data.currentQuestion)
              setLocalGameState('question')
              setLocalResult(null)
            }
          } else if (data.lastResult && data.gameState === 'idle') {
            if (localGameState !== 'result') {
              setLocalResult(data.lastResult)
              setLocalGameState('result')
            }
          } else if (data.gameState === 'spinning') {
            if (localGameState !== 'spinning') {
              setLocalGameState('spinning')
              if (!isHost) spinWheel(false) // Guest apenas visualiza
            }
          } else if (data.gameState !== localGameState) {
            if (localGameState !== 'versus-menu') {
              setLocalGameState(data.gameState)
            }
          }
        } else {
          if (localGameState !== 'versus-menu') {
            alert('A sala foi encerrada.')
            resetGame()
          }
        }
      },
      error => console.error('Erro no listener:', error)
    )

    return () => unsubscribe()
  }, [gameId, localGameState, localQuestion, isHost])

  // --- FUNÇÕES DE JOGO ---
  const createGame = async () => {
    if (!playerName) return setError('Digite seu nome')
    setError(null)
    const newId = nanoid()
    try {
      await setDoc(doc(db, 'games', newId), {
        player1Name: playerName,
        player1Score: 0,
        player2Name: null,
        player2Score: 0,
        gameState: 'waiting',
        currentQuestion: null,
        selectedCategory: null,
        lastResult: null,
        createdAt: new Date().toISOString()
      })
      setGameId(newId)
      setIsHost(true)
      setLocalGameState('waiting')
    } catch (e) {
      console.error(e)
      setError('Erro ao criar sala.')
    }
  }

  const joinGame = async () => {
    if (!playerName || !gameId) return setError('Preencha nome e código')
    setError(null)
    const cleanId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanId)
    try {
      const snap = await getDoc(gameRef)
      if (snap.exists()) {
        const data = snap.data()
        if (!data.player2Name) {
          await updateDoc(gameRef, { player2Name: playerName })
          setIsHost(false)
          setLocalGameState('waiting')
        } else {
          setError('Sala cheia.')
        }
      } else {
        setError('Sala não encontrada.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro ao entrar.')
    }
  }

  const resetGame = () => {
    setGameId('')
    setGameData(null)
    setPlayerName('')
    setIsHost(false)
    setLocalGameState('versus-menu')
    setLocalQuestion(null)
    setLocalResult(null)
    setError(null)
  }

  const startRound = async () => {
    if (!isHost) return
    await updateDoc(doc(db, 'games', gameId), {
      gameState: 'spinning',
      lastResult: null
    })
    spinWheel(true)
  }

  const spinWheel = async (shouldGenerate = true) => {
    setLocalGameState('spinning')
    setLocalResult(null)
    setLocalQuestion(null)

    let currentSpin = 0
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)

    // Animação mais rápida no início
    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(prev => (prev + 1) % categories.length)
      currentSpin++
    }, 80)

    setTimeout(async () => {
      clearInterval(spinIntervalRef.current)
      const finalIndex = Math.floor(Math.random() * categories.length)
      setSpinningIndex(finalIndex)
      const category = categories[finalIndex]

      if (shouldGenerate) {
        if (!gameId || isHost) {
          await generateQuestion(category)
        }
      }
    }, 2500)
  }

  // --- INTEGRAÇÃO COM IA (Prompt Refinado) ---
  const generateQuestion = async category => {
    if (!groqClient) return

    // Prompt otimizado para perguntas interessantes
    const prompt = `Atue como um apresentador de Game Show inteligente. Gere uma pergunta de nível médio/difícil sobre a categoria: ${category.name}.
    Responda APENAS um JSON neste formato exato, sem markdown: 
    {"pergunta": "Texto da pergunta", "alternativas": ["Opção A", "Opção B", "Opção C", "Opção D"], "respostaCorreta": "Texto exato da opção correta"}.
    Idioma: Português do Brasil.`

    try {
      const completion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.7
      })

      const content = JSON.parse(completion.choices[0]?.message?.content)

      if (gameId) {
        await updateDoc(doc(db, 'games', gameId), {
          currentQuestion: content,
          selectedCategory: category.id,
          gameState: 'question'
        })
      } else {
        setLocalQuestion(content)
        setLocalGameState('question')
      }
    } catch (e) {
      console.error(e)
      setError('A IA demorou para responder. Tente novamente.')
      if (gameId)
        await updateDoc(doc(db, 'games', gameId), { gameState: 'idle' })
      else setLocalGameState('idle')
    }
  }

  const handleAnswer = async answer => {
    if (!localQuestion) return
    const isCorrect = answer === localQuestion.respostaCorreta

    if (gameId) {
      const myScoreField = isHost ? 'player1Score' : 'player2Score'
      const currentScore = (gameData && gameData[myScoreField]) || 0

      try {
        await updateDoc(doc(db, 'games', gameId), {
          [myScoreField]: currentScore + (isCorrect ? 1 : 0),
          lastResult: isCorrect ? 'correct' : 'incorrect',
          gameState: 'idle'
        })
      } catch (e) {
        console.error('Erro ao enviar resposta:', e)
      }
    } else {
      // Modo Solo
      if (isCorrect) {
        setLocalResult('correct')
        setSoloScores(prev => ({
          ...prev,
          [categories[spinningIndex].id]: prev[categories[spinningIndex].id] + 1
        }))
      } else {
        setLocalResult('incorrect')
      }
      setLocalGameState('result')
    }
  }

  // --- COMPONENTES UI ---

  const renderCategoryCard = (cat, isSelected = false) => (
    <div
      key={cat.id}
      className={`
        flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 shadow-lg
        ${
          isSelected
            ? `${cat.color} scale-110 ring-4 ring-white z-10`
            : 'bg-gray-800 opacity-60 scale-90'
        }
      `}
    >
      <div className='bg-white/20 p-3 rounded-full mb-2'>
        <FontAwesomeIcon icon={cat.icon} className='text-white text-2xl' />
      </div>
      <span className='text-white font-bold text-sm uppercase tracking-wider'>
        {cat.name}
      </span>
      {/* Mostra score apenas se não estiver girando a roleta principal */}
      {localGameState !== 'spinning' && !gameId && (
        <span className='text-xs font-mono mt-1 text-white/80'>
          Lvl {soloScores[cat.id]}
        </span>
      )}
    </div>
  )

  return (
    <div className='min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center'>
      {/* HEADER */}
      <header className='w-full p-6 flex flex-col items-center bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 shadow-md mb-6'>
        <div className='flex items-center gap-3'>
          <FontAwesomeIcon icon={faBrain} className='text-4xl text-blue-500' />
          <h1 className='text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500 tracking-tight'>
            QUESTIONADOS
          </h1>
        </div>
        {gameId && (
          <div className='mt-2 px-4 py-1 bg-gray-700 rounded-full text-xs font-mono text-gray-300'>
            SALA: <span className='text-white font-bold'>{gameId}</span>
          </div>
        )}
      </header>

      <main className='w-full max-w-4xl px-4 flex-grow flex flex-col items-center'>
        {/* ERROR TOAST */}
        {error && (
          <div className='fixed top-20 z-50 animate-bounce bg-red-500 text-white px-6 py-3 rounded-full shadow-xl border-2 border-red-600 font-bold flex items-center gap-3'>
            <FontAwesomeIcon icon={faTimesCircle} />
            {error}
            <button
              onClick={() => setError(null)}
              className='ml-4 underline text-xs'
            >
              Fechar
            </button>
          </div>
        )}

        {/* PLACAR VERSUS (Apenas se estiver em sala) */}
        {gameId && gameData && (
          <div className='w-full max-w-2xl grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-8'>
            <div
              className={`p-4 rounded-2xl border-2 ${
                isHost
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-gray-800 border-gray-700'
              } text-center transition-all`}
            >
              <div className='text-sm text-gray-400 uppercase font-bold mb-1'>
                {gameData.player1Name}
              </div>
              <div className='text-4xl font-black text-white'>
                {gameData.player1Score}
              </div>
            </div>

            <div className='text-2xl font-black text-gray-600 italic'>VS</div>

            <div
              className={`p-4 rounded-2xl border-2 ${
                !isHost && gameData.player2Name
                  ? 'bg-red-600/20 border-red-500'
                  : 'bg-gray-800 border-gray-700'
              } text-center transition-all`}
            >
              <div className='text-sm text-gray-400 uppercase font-bold mb-1'>
                {gameData.player2Name || 'Aguardando...'}
              </div>
              <div className='text-4xl font-black text-white'>
                {gameData.player2Score}
              </div>
            </div>
          </div>
        )}

        {/* ESTADO: MENU */}
        {localGameState === 'versus-menu' && (
          <div className='w-full max-w-md bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 text-center'>
            <h2 className='text-2xl font-bold mb-6 text-blue-400'>
              Modo Versus
            </h2>

            <div className='space-y-4'>
              <input
                className='w-full bg-gray-900/50 border border-gray-600 p-4 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-center font-bold text-lg'
                placeholder='Seu Apelido'
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
              />

              <button
                onClick={createGame}
                className='w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-transform'
              >
                Criar Nova Sala
              </button>

              <div className='relative py-2'>
                <div className='absolute inset-0 flex items-center'>
                  <div className='w-full border-t border-gray-700'></div>
                </div>
                <div className='relative flex justify-center'>
                  <span className='bg-gray-800 px-4 text-sm text-gray-500'>
                    OU ENTRE EM UMA
                  </span>
                </div>
              </div>

              <div className='flex gap-2'>
                <input
                  className='flex-1 bg-gray-900/50 border border-gray-600 p-4 rounded-xl text-white text-center uppercase font-mono text-lg tracking-widest outline-none focus:border-green-500'
                  placeholder='CÓDIGO'
                  maxLength={6}
                  value={gameId}
                  onChange={e => setGameId(e.target.value.toUpperCase())}
                />
                <button
                  onClick={joinGame}
                  className='px-6 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition-colors'
                >
                  Entrar
                </button>
              </div>

              <button
                onClick={() => setLocalGameState('idle')}
                className='text-sm text-gray-500 hover:text-white mt-4 underline'
              >
                Jogar Modo Solo (Offline)
              </button>
            </div>
          </div>
        )}

        {/* ESTADO: WAITING (Lobby) */}
        {localGameState === 'waiting' && (
          <div className='text-center animate-fade-in'>
            <div className='inline-block p-6 bg-gray-800 rounded-full mb-6 animate-pulse'>
              <FontAwesomeIcon
                icon={faUserGroup}
                className='text-5xl text-blue-400'
              />
            </div>
            <h2 className='text-3xl font-bold mb-2'>Aguardando Jogadores</h2>
            <p className='text-gray-400 mb-8'>
              Compartilhe o código abaixo com seu amigo
            </p>

            <div className='bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl p-6 mb-8 inline-block'>
              <span
                className='text-4xl font-mono font-black tracking-[0.2em] text-white select-all cursor-pointer'
                onClick={() => navigator.clipboard.writeText(gameId)}
              >
                {gameId}
              </span>
            </div>

            {isHost && gameData?.player2Name && (
              <button
                onClick={startRound}
                className='block w-full max-w-sm mx-auto bg-green-500 hover:bg-green-400 text-white py-4 rounded-xl font-black text-xl shadow-lg hover:-translate-y-1 transition-all animate-bounce'
              >
                COMEÇAR PARTIDA
              </button>
            )}

            {!isHost && (
              <p className='text-yellow-500 font-medium animate-pulse'>
                {gameData?.player2Name
                  ? 'Aguardando o Host iniciar...'
                  : 'Entrando na sala...'}
              </p>
            )}

            <button
              onClick={resetGame}
              className='mt-12 text-gray-500 hover:text-red-400 text-sm'
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ESTADO: ROLETANDO (Interface da Main) */}
        {localGameState === 'spinning' && (
          <div className='w-full flex flex-col items-center'>
            {/* Grid de Categorias com destaque na selecionada */}
            <div className='grid grid-cols-3 gap-4 mb-10'>
              {categories.map((cat, i) =>
                renderCategoryCard(cat, spinningIndex === i)
              )}
            </div>

            {/* Mensagem da Branch Main */}
            <div className='bg-gray-800 px-8 py-6 rounded-2xl border border-gray-700 shadow-2xl text-center max-w-lg animate-pulse'>
              <h3 className='text-xl font-bold text-white mb-2'>
                Sorteando Categoria...
              </h3>
              <p className='text-blue-400 font-medium'>
                A Inteligência Artificial está criando um desafio exclusivo para
                você...
              </p>
            </div>
          </div>
        )}

        {/* ESTADO: PERGUNTA (Card Estilizado) */}
        {localGameState === 'question' && localQuestion && (
          <div className='w-full max-w-2xl animate-slide-up'>
            {/* Cabeçalho da Categoria */}
            <div className='flex justify-center -mb-6 relative z-10'>
              <div
                className={`${
                  categories.find(
                    c => c.id === (gameData?.selectedCategory || 'art')
                  )?.color || 'bg-gray-500'
                } px-8 py-3 rounded-full shadow-lg flex items-center gap-3`}
              >
                <FontAwesomeIcon
                  icon={
                    categories.find(
                      c => c.id === (gameData?.selectedCategory || 'art')
                    )?.icon
                  }
                />
                <span className='font-black uppercase tracking-wider'>
                  {
                    categories.find(
                      c => c.id === (gameData?.selectedCategory || 'art')
                    )?.name
                  }
                </span>
              </div>
            </div>

            {/* Card da Pergunta */}
            <div className='bg-gray-800 pt-10 pb-8 px-8 rounded-3xl shadow-2xl border border-gray-700'>
              <h3 className='text-2xl font-bold text-center mb-8 leading-relaxed text-gray-100'>
                {localQuestion.pergunta}
              </h3>

              <div className='grid grid-cols-1 gap-3'>
                {localQuestion.alternativas.map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(alt)}
                    className='group relative overflow-hidden bg-gray-700 hover:bg-blue-600 border border-gray-600 hover:border-blue-400 p-5 rounded-xl text-left transition-all duration-200'
                  >
                    <span className='relative z-10 font-medium text-lg group-hover:text-white'>
                      {alt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ESTADO: RESULTADO */}
        {localGameState === 'result' && (
          <div className='text-center animate-scale-in w-full max-w-lg px-4'>
            <div className='mb-6'>
              {localResult === 'correct' ? (
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className='text-8xl text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                />
              ) : (
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className='text-8xl text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                />
              )}
            </div>

            <h2 className='text-4xl font-black mb-2'>
              {localResult === 'correct' ? 'RESPOSTA CORRETA!' : 'QUE PENA!'}
            </h2>

            {/* FEEDBACK DE RESPOSTA */}
            {localResult === 'correct' ? (
              <p className='text-gray-400 mb-8 text-lg'>+1 Ponto adicionado</p>
            ) : (
              <div className='mb-8'>
                <p className='text-gray-400 mb-4'>Você errou...</p>
                {localQuestion && (
                  <div className='bg-gray-800/80 border border-green-500/30 p-4 rounded-xl animate-pulse'>
                    <div className='flex items-center justify-center gap-2 text-green-400 mb-1'>
                      <FontAwesomeIcon icon={faLightbulb} />
                      <span className='text-xs font-bold uppercase tracking-widest'>
                        A resposta correta era:
                      </span>
                    </div>
                    <p className='text-white font-black text-xl'>
                      {localQuestion.respostaCorreta}
                    </p>
                  </div>
                )}
              </div>
            )}

            {gameId ? (
              isHost ? (
                <button
                  onClick={startRound}
                  className='px-8 py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl w-full sm:w-auto'
                >
                  Próxima Rodada{' '}
                  <FontAwesomeIcon icon={faTrophy} className='ml-2' />
                </button>
              ) : (
                <div className='flex flex-col items-center gap-3 bg-gray-800/50 p-4 rounded-xl'>
                  <div className='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                  <p className='text-sm text-gray-400'>
                    Aguardando o Host iniciar a próxima...
                  </p>
                </div>
              )
            ) : (
              <button
                onClick={() => spinWheel(true)}
                className='px-8 py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl'
              >
                Continuar Jogando
              </button>
            )}
          </div>
        )}

        {/* ESTADO: IDLE (SOLO) */}
        {localGameState === 'idle' && !gameId && (
          <div className='flex flex-col items-center w-full'>
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12 w-full max-w-lg'>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className='bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center'
                >
                  <FontAwesomeIcon
                    icon={cat.icon}
                    className={`${cat.textColor} text-2xl mb-2`}
                  />
                  <span className='text-xs text-gray-400 uppercase'>
                    {cat.name}
                  </span>
                  <span className='text-xl font-bold'>
                    {soloScores[cat.id]}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => spinWheel(true)}
              className='w-full max-w-xs bg-gradient-to-r from-pink-500 to-orange-500 py-5 rounded-2xl font-black text-2xl shadow-2xl hover:scale-105 transition-transform'
            >
              GIRAR ROLETA
            </button>

            <button
              onClick={() => setLocalGameState('versus-menu')}
              className='mt-8 text-gray-500 hover:text-white transition-colors'
            >
              Voltar ao Menu Principal
            </button>
          </div>
        )}
      </main>

      <footer className='mt-12 py-6 text-center text-gray-600 text-sm border-t border-gray-800 w-full bg-gray-900'>
        <p>Questionados Remake • Powered by Groq AI</p>
      </footer>

      {/* Estilos globais para animações simples */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  )
}
